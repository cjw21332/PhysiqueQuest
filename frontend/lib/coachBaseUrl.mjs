/** Resolve the independently deployed Coach service, without the account API. */
export function resolveCoachBaseUrl(configured, runtime, location) {
  const value = configured?.trim() || runtime?.trim();
  try {
    const url = value ? new URL(value) : new URL(`${location?.protocol ?? 'http:'}//${location?.hostname ?? 'localhost'}:4050/api`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    const path = url.pathname.replace(/\/+$/, '');
    url.pathname = /\/api$/i.test(path) ? path : `${path}/api`;
    url.search = ''; url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch { return null; }
}
