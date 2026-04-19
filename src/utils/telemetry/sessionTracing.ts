export type Span = null
export type LLMRequestNewContext = object

export function startInteractionSpan(_name: string, _attrs?: unknown): Span { return null }
export function endInteractionSpan(_span: Span): void {}

export function startToolSpan(_name: string, _attrs?: unknown): Span { return null }
export function endToolSpan(_span: Span, _attrs?: unknown): void {}
export function startToolExecutionSpan(_name: string, _attrs?: unknown): Span { return null }
export function endToolExecutionSpan(_span: Span, _attrs?: unknown): void {}
export function startToolBlockedOnUserSpan(_name: string, _attrs?: unknown): Span { return null }
export function endToolBlockedOnUserSpan(_span: Span): void {}
export function addToolContentEvent(_span: Span, _attrs?: unknown): void {}

export function startLLMRequestSpan(_name: string, _attrs?: unknown): Span { return null }
export function endLLMRequestSpan(_span: Span, _attrs?: unknown): void {}

export function startHookSpan(_name: string, _attrs?: unknown): Span { return null }
export function endHookSpan(_span: Span, _attrs?: unknown): void {}

export function isBetaTracingEnabled(): boolean { return false }
export function getCurrentSpan(): Span { return null }
export function setSpanAttribute(_key: string, _value: unknown): void {}
export function recordToolCall(_span: Span, _attrs?: unknown): void {}
export function recordApiCall(_span: Span, _attrs?: unknown): void {}
