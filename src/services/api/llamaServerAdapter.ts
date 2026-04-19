/**
 * Translates Anthropic API requests/responses to/from the OpenAI-compatible
 * format exposed by llama-server (llama.cpp).
 *
 * Environment variables:
 *   LLAMA_SERVER_BASE_URL  - Base URL of llama-server (default: http://localhost:8080)
 *   LLAMA_SERVER_MODEL     - Model name to send to llama-server (default: "default")
 *
 * Only POST /v1/messages calls are intercepted; everything else is forwarded as-is.
 */

function getLlamaServerBaseUrl(): string {
  return (process.env.LLAMA_SERVER_BASE_URL || 'http://localhost:8080').replace(/\/$/, '')
}

function getLlamaServerModel(): string {
  return process.env.LLAMA_SERVER_MODEL || 'default'
}

// ---------------------------------------------------------------------------
// Request translation: Anthropic → OpenAI
// ---------------------------------------------------------------------------

function extractTextFromContentBlocks(blocks: unknown): string {
  if (!Array.isArray(blocks)) return typeof blocks === 'string' ? blocks : ''
  return blocks
    .filter((b: Record<string, unknown>) => b.type === 'text')
    .map((b: Record<string, unknown>) => String(b.text ?? ''))
    .join('\n')
}

function anthropicToOpenAI(anthropicBody: Record<string, unknown>): Record<string, unknown> {
  const openAIMessages: Record<string, unknown>[] = []

  // System prompt → first system message
  if (anthropicBody.system) {
    const systemText =
      typeof anthropicBody.system === 'string'
        ? anthropicBody.system
        : extractTextFromContentBlocks(anthropicBody.system)
    if (systemText) {
      openAIMessages.push({ role: 'system', content: systemText })
    }
  }

  // Conversation messages
  for (const msg of (anthropicBody.messages as Record<string, unknown>[]) ?? []) {
    const role = msg.role as string
    const content = msg.content

    if (role === 'user') {
      if (typeof content === 'string') {
        openAIMessages.push({ role: 'user', content })
        continue
      }

      // Content is an array of blocks — split into user text + tool results
      const textParts: string[] = []
      const toolResults: Record<string, unknown>[] = []

      for (const block of (content as Record<string, unknown>[]) ?? []) {
        if (block.type === 'tool_result') {
          const resultContent = Array.isArray(block.content)
            ? extractTextFromContentBlocks(block.content)
            : typeof block.content === 'string'
              ? block.content
              : ''
          toolResults.push({
            role: 'tool',
            tool_call_id: block.tool_use_id,
            content: resultContent,
          })
        } else if (block.type === 'text') {
          textParts.push(String(block.text ?? ''))
        }
        // image blocks: skipped (most local models don't support vision)
      }

      if (textParts.length > 0) {
        openAIMessages.push({ role: 'user', content: textParts.join('\n') })
      }
      openAIMessages.push(...toolResults)
    } else if (role === 'assistant') {
      if (typeof content === 'string') {
        openAIMessages.push({ role: 'assistant', content })
        continue
      }

      let textContent = ''
      const toolCalls: Record<string, unknown>[] = []

      for (const block of (content as Record<string, unknown>[]) ?? []) {
        if (block.type === 'text') {
          textContent += String(block.text ?? '')
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id,
            type: 'function',
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input ?? {}),
            },
          })
        }
      }

      const assistantMsg: Record<string, unknown> = { role: 'assistant' }
      if (textContent) assistantMsg.content = textContent
      if (toolCalls.length > 0) assistantMsg.tool_calls = toolCalls
      openAIMessages.push(assistantMsg)
    }
  }

  // Tools
  const anthropicTools = anthropicBody.tools as Record<string, unknown>[] | undefined
  const openAITools =
    anthropicTools?.length
      ? anthropicTools.map(tool => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description ?? '',
            parameters: tool.input_schema ?? { type: 'object', properties: {} },
          },
        }))
      : undefined

  const body: Record<string, unknown> = {
    model: getLlamaServerModel(),
    messages: openAIMessages,
    max_tokens: anthropicBody.max_tokens,
    stream: anthropicBody.stream ?? false,
  }

  if (anthropicBody.temperature !== undefined) {
    body.temperature = anthropicBody.temperature
  }
  if (openAITools) {
    body.tools = openAITools
  }

  return body
}

// ---------------------------------------------------------------------------
// Response translation: OpenAI → Anthropic (non-streaming)
// ---------------------------------------------------------------------------

const FINISH_REASON_TO_STOP_REASON: Record<string, string> = {
  stop: 'end_turn',
  length: 'max_tokens',
  tool_calls: 'tool_use',
  content_filter: 'stop_sequence',
}

function openAIToAnthropic(openAIData: Record<string, unknown>, model: string): Record<string, unknown> {
  const choices = openAIData.choices as Record<string, unknown>[] | undefined
  const choice = choices?.[0] as Record<string, unknown> | undefined
  const message = choice?.message as Record<string, unknown> | undefined
  const finishReason = String(choice?.finish_reason ?? 'stop')
  const usage = openAIData.usage as Record<string, number> | undefined

  const content: Record<string, unknown>[] = []

  if (message?.content) {
    content.push({ type: 'text', text: String(message.content) })
  }

  for (const tc of (message?.tool_calls as Record<string, unknown>[]) ?? []) {
    const fn = tc.function as Record<string, unknown>
    let input: unknown = {}
    try {
      input = JSON.parse(String(fn.arguments ?? '{}'))
    } catch {
      input = {}
    }
    content.push({
      type: 'tool_use',
      id: tc.id,
      name: fn.name,
      input,
    })
  }

  const rawId = String(openAIData.id ?? '')
  const id = rawId.startsWith('chatcmpl-')
    ? rawId.replace('chatcmpl-', 'msg_')
    : rawId || `msg_${Math.random().toString(36).slice(2)}`

  return {
    id,
    type: 'message',
    role: 'assistant',
    content,
    model,
    stop_reason: FINISH_REASON_TO_STOP_REASON[finishReason] ?? 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: usage?.prompt_tokens ?? 0,
      output_tokens: usage?.completion_tokens ?? 0,
    },
  }
}

// ---------------------------------------------------------------------------
// Streaming: collect OpenAI SSE chunks, emit Anthropic SSE events
// ---------------------------------------------------------------------------

interface CollectedStream {
  text: string
  toolCalls: Array<{ id: string; name: string; arguments: string }>
  stopReason: string
  usage: { input_tokens: number; output_tokens: number }
}

async function collectOpenAIStream(response: Response): Promise<CollectedStream> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('llama-server returned no response body')

  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''
  const toolCallsMap = new Map<number, { id: string; name: string; arguments: string }>()
  let stopReason = 'end_turn'
  let usage = { input_tokens: 0, output_tokens: 0 }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const dataStr = line.slice(6).trim()
        if (dataStr === '[DONE]') continue

        let data: Record<string, unknown>
        try {
          data = JSON.parse(dataStr)
        } catch {
          continue
        }

        const choices = data.choices as Record<string, unknown>[] | undefined
        const delta = choices?.[0]?.delta as Record<string, unknown> | undefined
        const finishReason = choices?.[0]?.finish_reason as string | undefined

        if (finishReason === 'tool_calls') stopReason = 'tool_use'
        else if (finishReason === 'length') stopReason = 'max_tokens'

        if (typeof delta?.content === 'string') {
          text += delta.content
        }

        for (const tc of (delta?.tool_calls as Record<string, unknown>[]) ?? []) {
          const idx = (tc.index as number) ?? 0
          if (!toolCallsMap.has(idx)) {
            toolCallsMap.set(idx, { id: '', name: '', arguments: '' })
          }
          const entry = toolCallsMap.get(idx)!
          const fn = tc.function as Record<string, string> | undefined
          if (tc.id) entry.id = String(tc.id)
          if (fn?.name) entry.name += fn.name
          if (fn?.arguments) entry.arguments += fn.arguments
        }

        if (data.usage) {
          const u = data.usage as Record<string, number>
          usage = {
            input_tokens: u.prompt_tokens ?? 0,
            output_tokens: u.completion_tokens ?? 0,
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  const toolCalls = Array.from(toolCallsMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([, tc]) => tc)

  return { text, toolCalls, stopReason, usage }
}

function buildAnthropicSSE(collected: CollectedStream, model: string, messageId: string): string {
  const events: string[] = []
  const emit = (event: string, data: unknown) => {
    events.push(`event: ${event}\ndata: ${JSON.stringify(data)}\n`)
  }

  const hasText = collected.text.length > 0
  const hasTools = collected.toolCalls.length > 0

  // message_start
  emit('message_start', {
    type: 'message_start',
    message: {
      id: messageId,
      type: 'message',
      role: 'assistant',
      content: [],
      model,
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: collected.usage.input_tokens, output_tokens: 0 },
    },
  })

  emit('ping', { type: 'ping' })

  let blockIndex = 0

  // Text block
  if (hasText) {
    emit('content_block_start', {
      type: 'content_block_start',
      index: blockIndex,
      content_block: { type: 'text', text: '' },
    })
    emit('content_block_delta', {
      type: 'content_block_delta',
      index: blockIndex,
      delta: { type: 'text_delta', text: collected.text },
    })
    emit('content_block_stop', { type: 'content_block_stop', index: blockIndex })
    blockIndex++
  }

  // Tool use blocks
  for (const tc of collected.toolCalls) {
    emit('content_block_start', {
      type: 'content_block_start',
      index: blockIndex,
      content_block: { type: 'tool_use', id: tc.id, name: tc.name, input: {} },
    })
    emit('content_block_delta', {
      type: 'content_block_delta',
      index: blockIndex,
      delta: { type: 'input_json_delta', partial_json: tc.arguments },
    })
    emit('content_block_stop', { type: 'content_block_stop', index: blockIndex })
    blockIndex++
  }

  // If neither text nor tools, emit an empty text block so the SDK doesn't choke
  if (!hasText && !hasTools) {
    emit('content_block_start', {
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'text', text: '' },
    })
    emit('content_block_stop', { type: 'content_block_stop', index: 0 })
  }

  // message_delta
  emit('message_delta', {
    type: 'message_delta',
    delta: { stop_reason: collected.stopReason, stop_sequence: null },
    usage: { output_tokens: collected.usage.output_tokens },
  })

  // message_stop
  emit('message_stop', { type: 'message_stop' })

  return events.join('\n') + '\n'
}

// ---------------------------------------------------------------------------
// Main adapter: custom fetch factory
// ---------------------------------------------------------------------------

/**
 * Returns a fetch function that intercepts Anthropic /v1/messages calls and
 * translates them to llama-server's OpenAI-compatible /v1/chat/completions.
 */
export function createLlamaServerFetch(): (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response> {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = input instanceof Request ? input.url : String(input)

    if (!url.includes('/v1/messages')) {
      // Not an Anthropic messages call — pass through unchanged
      // eslint-disable-next-line eslint-plugin-n/no-unsupported-features/node-builtins
      return globalThis.fetch(input, init)
    }

    let anthropicBody: Record<string, unknown>
    try {
      anthropicBody = JSON.parse(String(init?.body ?? '{}'))
    } catch {
      anthropicBody = {}
    }

    const isStreaming = anthropicBody.stream === true
    const model = String(anthropicBody.model ?? getLlamaServerModel())
    const openAIBody = anthropicToOpenAI(anthropicBody)
    const llamaUrl = `${getLlamaServerBaseUrl()}/v1/chat/completions`

    let llamaResponse: Response
    try {
      // eslint-disable-next-line eslint-plugin-n/no-unsupported-features/node-builtins
      llamaResponse = await globalThis.fetch(llamaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(openAIBody),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return new Response(
        JSON.stringify({
          type: 'error',
          error: {
            type: 'api_error',
            message: `Failed to connect to llama-server at ${getLlamaServerBaseUrl()}: ${message}`,
          },
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      )
    }

    if (!llamaResponse.ok) {
      const errorText = await llamaResponse.text().catch(() => '(no body)')
      return new Response(
        JSON.stringify({
          type: 'error',
          error: { type: 'api_error', message: `llama-server error: ${errorText}` },
        }),
        { status: llamaResponse.status, headers: { 'Content-Type': 'application/json' } },
      )
    }

    if (!isStreaming) {
      const openAIData = (await llamaResponse.json()) as Record<string, unknown>
      const anthropicData = openAIToAnthropic(openAIData, model)
      return new Response(JSON.stringify(anthropicData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Streaming: collect all OpenAI chunks, then emit synthetic Anthropic SSE
    const messageId = `msg_${Math.random().toString(36).slice(2)}`
    const collected = await collectOpenAIStream(llamaResponse)
    const sseBody = buildAnthropicSSE(collected, model, messageId)

    return new Response(sseBody, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  }
}
