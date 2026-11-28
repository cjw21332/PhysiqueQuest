const sessionPattern = /^[a-f0-9]{64}\.[a-f0-9]{64}$/;
const authPaths = new Set([
  '/api/auth/session/admin-login', '/api/auth/session/login', '/api/auth/session/refresh',
  '/api/auth/me', '/api/auth/logout', '/api/auth/admin-initial-password',
  '/api/auth/password-reset/request', '/api/auth/password-reset/verify', '/api/auth/password-reset/confirm',
]);

/** Only the dashboard's APIs can be reached through the local gateway. */
export function allowedBackendPath(method, path) {
  if (!['GET','POST','PUT','PATCH','DELETE'].includes(method)) return false;
  if (path === '/ready') return method === 'GET';
  if (authPaths.has(path)) return path === '/api/auth/me' ? method === 'GET' : method === 'POST';
  if (/^\/api\/admin(?:\/[A-Za-z0-9_-]+)*$/.test(path)) return true;
  if (method === 'GET' && (path === '/api/profile' || /^\/api\/pose-tracker\/exercises\/[A-Za-z0-9_-]+$/.test(path))) return true;
  return false;
}

export function allowedLocalRequest({host, origin, method, fetchSite}, port) {
  const expected = `127.0.0.1:${port}`;
  if (host !== expected || fetchSite === 'cross-site') return false;
  if (origin && origin !== `http://${expected}`) return false;
  return ['GET','HEAD'].includes(method) || origin === `http://${expected}`;
}

export function upstreamHeaders(headers, backendOrigin) {
  const result = {};
  for (const name of ['accept','content-type','content-length','authorization','x-request-id','x-app-version']) {
    if (typeof headers[name] === 'string') result[name] = headers[name];
  }
  const token = String(headers.cookie ?? '').split(';').map(value=>value.trim()).find(value=>value.startsWith('pq_admin_refresh='))?.slice('pq_admin_refresh='.length);
  if (token && sessionPattern.test(token)) result.cookie = `pq_refresh=${token}`;
  result.origin = backendOrigin;
  return result;
}

export function isolatedCookies(cookies = []) {
  return cookies.filter(cookie=>/^pq_refresh=/i.test(cookie)).map(cookie=>cookie.replace(/^pq_refresh=/i,'pq_admin_refresh=').replace(/;\s*domain=[^;]*/ig,''));
}
