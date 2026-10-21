const PRIVATE_IPV4_PATTERN = /^(?:10\.(?:\d{1,3}\.){2}\d{1,3}|192\.168\.(?:\d{1,3}\.)\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.(?:\d{1,3}\.)\d{1,3})$/;

export function isTrustedWebViewUrl(value, frontendUrl) {
  try {
    const source = new URL(value), frontend = new URL(frontendUrl);
    return !source.username && !source.password && source.origin === frontend.origin && ['http:', 'https:'].includes(source.protocol);
  } catch { return false; }
}

function withHttpScheme(value) {
  return /^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `http://${value}`;
}

function isPrivateIpv4(hostname) {
  if (!PRIVATE_IPV4_PATTERN.test(hostname)) return false;
  return hostname.split('.').every(part => Number(part) >= 0 && Number(part) <= 255);
}

/** @param {string} input @returns {string | null} */
export function normalizeFrontendUrl(input) {
  const value = input.trim();
  if (!value) return null;

  try {
    const url = new URL(withHttpScheme(value));
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname) return null;
    if (url.username || url.password) return null;
    url.pathname = url.pathname.replace(/\/+$/, '') || '';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

/** @param {string | undefined} configuredUrl @param {string | undefined} hostUri @returns {string | null} */
export function resolveFrontendUrl(configuredUrl, hostUri) {
  if (configuredUrl?.trim()) return normalizeFrontendUrl(configuredUrl);
  if (!hostUri) return null;

  const hostAndPort = hostUri.trim().replace(/^[a-z][a-z\d+.-]*:\/\//i, '').split(/[/?#]/, 1)[0];
  const hostname = hostAndPort.replace(/:\d+$/, '');
  if (!isPrivateIpv4(hostname)) return null;

  return `http://${hostname}:3000`;
}

/** @param {string | undefined} configuredApiUrl @param {string} frontendUrl @returns {string | null} */
export function resolveApiUrl(configuredApiUrl, frontendUrl) {
  let url;
  try {
    url = new URL(withHttpScheme(configuredApiUrl?.trim() || frontendUrl));
  } catch {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username || url.password || !url.hostname) return null;
  const path = url.pathname.replace(/\/+$/, '');
  url.pathname = /\/api$/i.test(path) ? path : `${path}/api`;
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}
