export type EventSamplingConfig = { sampleRate: number }
export function getEventSamplingConfig(): EventSamplingConfig { return { sampleRate: 0 } }
export function shouldSampleEvent(_name: string): number | null { return null }
export async function shutdown1PEventLogging(): Promise<void> {}
export function is1PEventLoggingEnabled(): boolean { return false }
export function logEventTo1P(_name: string, _metadata?: unknown): void {}
export type GrowthBookExperimentData = object
export function logGrowthBookExperimentTo1P(_data: unknown): void {}
export function initialize1PEventLogging(): void {}
export async function reinitialize1PEventLoggingIfConfigChanged(): Promise<void> {}
