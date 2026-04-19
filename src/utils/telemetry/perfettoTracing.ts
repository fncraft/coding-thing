export function unregisterAgent(_id: string): void {}
export function registerAgent(_id: string, _name: string): void {}
export function startPerfettoTrace(): void {}
export function stopPerfettoTrace(): void {}
export function recordPerfettoEvent(_name: string, _attrs?: unknown): void {}
export function isPerfettoTracingEnabled(): boolean { return false }
