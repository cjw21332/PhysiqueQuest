export function normalizeFrontendUrl(input: string): string | null;
export function selectConfiguredUrl(localDev: boolean, publicUrl: string | undefined, releaseUrl: string | undefined): string | undefined;
export function resolveFrontendUrl(configuredUrl: string | undefined, hostUri: string | undefined): string | null;
export function resolveApiUrl(configuredApiUrl: string | undefined, frontendUrl: string): string | null;
export function isTrustedWebViewUrl(value: string, frontendUrl: string): boolean;
export function isTrustedWebViewNavigation(value: string, frontendUrl: string, isTopFrame?: boolean): boolean;
