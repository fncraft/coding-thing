import Anthropic, { type ClientOptions } from '@anthropic-ai/sdk'
import { createLlamaServerFetch } from './llamaServerAdapter.js'

export const CLIENT_REQUEST_ID_HEADER = 'x-client-request-id'

export async function getAnthropicClient({
  maxRetries,
  fetchOverride,
}: {
  apiKey?: string
  maxRetries: number
  model?: string
  fetchOverride?: ClientOptions['fetch']
  source?: string
}): Promise<Anthropic> {
  return new Anthropic({
    apiKey: 'llama-server',
    baseURL: (process.env.LLAMA_SERVER_BASE_URL || 'http://localhost:8080').replace(/\/$/, ''),
    maxRetries,
    dangerouslyAllowBrowser: true,
    fetch: fetchOverride ?? createLlamaServerFetch(),
  })
}
