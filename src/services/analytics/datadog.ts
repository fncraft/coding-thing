export const initializeDatadog = async (): Promise<boolean> => false
export async function shutdownDatadog(): Promise<void> {}
export async function trackDatadogEvent(_name: string, _props?: unknown): Promise<void> {}
