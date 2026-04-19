export type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS = never
export type AnalyticsMetadata_I_VERIFIED_THIS_IS_PII_TAGGED = never
export type AnalyticsSink = object

export function stripProtoFields<V>(obj: V): V { return obj }
export function attachAnalyticsSink(_sink: AnalyticsSink): void {}
export function logEvent(_name: string, _metadata?: unknown): void {}
export async function logEventAsync(_name: string, _metadata?: unknown): Promise<void> {}
export function _resetForTesting(): void {}
