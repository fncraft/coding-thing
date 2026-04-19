export type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS = never
export function sanitizeToolNameForAnalytics(name: string): string { return name }
export function isToolDetailsLoggingEnabled(): boolean { return false }
export function isAnalyticsToolDetailsLoggingEnabled(_name: string): boolean { return false }
export function mcpToolDetailsForAnalytics(_tool: unknown): object { return {} }
export function extractMcpToolDetails(_name: string): object { return {} }
export function extractSkillName(_name: string): string | null { return null }
export function extractToolInputForTelemetry(_input: unknown): unknown { return {} }
export function getFileExtensionForAnalytics(_path: string): string { return '' }
export function getFileExtensionsFromBashCommand(_cmd: string): string[] { return [] }
export type EnvContext = object
export type ProcessMetrics = object
export type EventMetadata = object
export type EnrichMetadataOptions = object
export async function getEventMetadata(_opts?: unknown): Promise<object> { return {} }
export type FirstPartyEventLoggingCoreMetadata = object
export type FirstPartyEventLoggingMetadata = object
export function to1PEventFormat(_name: string, _meta: unknown): object { return {} }
