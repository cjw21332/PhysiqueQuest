export function normalizeFrontendUrl(input: string): string | null;
export function resolveFrontendUrl(configuredUrl: string | undefined, hostUri: string | undefined): string | null;
export function resolveApiUrl(configuredApiUrl: string | undefined, frontendUrl: string): string | null;
export function isTrustedWebViewUrl(value: string, frontendUrl: string): boolean;
