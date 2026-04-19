export function hashPluginId(_name: string, _marketplace?: string): string { return '' }
export type TelemetryPluginScope = string
export function getTelemetryPluginScope(_scope: unknown): TelemetryPluginScope { return '' }
export type EnabledVia = string
export type InvocationTrigger = string
export type SkillExecutionContext = 'fork' | 'inline' | 'remote'
export type InstallSource = string
export function getEnabledVia(_source: unknown): EnabledVia { return '' }
export function buildPluginTelemetryFields(_plugin: unknown): object { return {} }
export function buildPluginCommandTelemetryFields(_cmd: unknown): object { return {} }
export function logPluginsEnabledForSession(_enabled: unknown[], _managed: unknown, _dirs: unknown[]): void {}
export function logPluginLoadErrors(_errors: unknown[], _managed: unknown): void {}
export function classifyPluginCommandError(_error: unknown): string { return 'unknown' }
