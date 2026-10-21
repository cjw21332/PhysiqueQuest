export function resolveApiBaseUrl(
  buildApiUrl: string | undefined,
  runtimeApiUrl: string | null | undefined,
  pageLocation: { protocol: string; hostname: string; port?: string } | undefined,
): string | null;
