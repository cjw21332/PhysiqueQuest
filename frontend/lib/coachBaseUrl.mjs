/** Resolve the independently deployed Coach service, without the account API. */
export function resolveCoachBaseUrl(configured, runtime, location) {
  const value = configured?.trim() || runtime?.trim();
  try {
    if (!value) {
      const origin = `${location?.protocol ?? 'http:'}//${location?.hostname ?? 'localhost'}${location?.port ? `:${location.port}` : ''}`;
      return new URL('/api/coach-service', origin).toString().replace(/\/$/, '');
    }
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    const path = url.pathname.replace(/\/+$/, '');
    url.pathname = /\/api$/i.test(path) ? path : `${path}/api`;
    url.search = ''; url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch { return null; }
}
