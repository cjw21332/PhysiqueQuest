function normalizeBaseUrl(value) {
  try {
    const url = new URL(value);
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname) return null;
    if (url.username || url.password) return null;
    const path = url.pathname.replace(/\/+$/, '');
    url.pathname = /\/api$/i.test(path) ? path : `${path}/api`;
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

/**
 * @param {string | undefined} buildApiUrl
 * @param {string | null | undefined} runtimeApiUrl
 * @param {{ protocol: string; hostname: string } | undefined} pageLocation
 * @returns {string | null}
 */
export function resolveApiBaseUrl(buildApiUrl, runtimeApiUrl, pageLocation) {
  if (!buildApiUrl?.trim() && runtimeApiUrl === null) return null;
  const configured = buildApiUrl?.trim() || runtimeApiUrl?.trim();
  if (configured) return normalizeBaseUrl(configured);

  if (!pageLocation) return 'http://localhost:4000/api';
  if (pageLocation.protocol !== 'http:' && pageLocation.protocol !== 'https:') return null;

  return normalizeBaseUrl(`${pageLocation.protocol}//${pageLocation.hostname}:4000/api`);
}
