import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { createDeviceCache } from '../lib/deviceCache.mjs';
import { resolveApiBaseUrl } from '../lib/apiBaseUrl.mjs';
import { resolveCoachBaseUrl } from '../lib/coachBaseUrl.mjs';
import * as errors from '../lib/apiErrors.mjs';

function client(fetcher, { initialUser = {}, refresh = async current => current } = {}) {
  const exports = {};
  const warnings = [];
  let current = { id: 'test-user', token: 'test-access', sessionKey: 1, expiresAt: Date.now() + 900_000, ...initialUser };
  let runtimeApiUrl = null;
  const modules = {
    './session': { appVersionHeaders: () => ({ 'X-App-Version': '1.0.0' }), clearAuthSession: () => { current = null; }, session: { current: () => current, refresh: async () => { current = await refresh(current); return current; } } },
    './apiBaseUrl.mjs': { resolveApiBaseUrl }, './coachBaseUrl.mjs': { resolveCoachBaseUrl },
    './deviceCache.mjs': { createDeviceCache }, './apiErrors.mjs': errors,
  };
  const output = ts.transpileModule(readFileSync(new URL('../lib/api.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(output, { exports, require: name => modules[name], fetch: fetcher, URL, URLSearchParams, Intl, AbortController,
    setTimeout, clearTimeout, TypeError, Error, process: { env: {} },
    console: { error: (...args) => warnings.push(args), warn: (...args) => warnings.push(args) },
    window: { location: { protocol: 'http:', hostname: 'localhost', port: '3000' }, localStorage: { getItem: key => key === 'physiquequest-runtime-api-url' ? runtimeApiUrl : null } },
  });
  return { ...exports, warnings, setRuntimeApiUrl: value => { runtimeApiUrl = value; } };
}

test('account requests include credentials; independent Coach requests omit them and account-only headers', async () => {
  const calls = [];
  const { api } = client(async (url, config) => { calls.push({ url, config }); return { ok: true, json: async () => ({}) }; });
  await api.getSettings();
  await api.getExercises();
  assert.equal(calls[0].config.credentials, 'include');
  assert.equal(calls[0].config.headers.Authorization, 'Bearer test-access');
  assert.equal(calls[0].config.headers['X-App-Version'], '1.0.0');
  assert.equal(calls[1].config.credentials, 'omit');
  assert.equal(calls[1].config.headers.Authorization, undefined);
  assert.equal(calls[1].config.headers['X-App-Version'], undefined);
});

test('failed data refresh reports its endpoint and a successful retry clears the cached error', async () => {
  let offline = false;
  const { api, deviceCache, warnings } = client(async url => {
    if (offline && url.endsWith('/nutrition')) throw new TypeError('Failed to fetch');
    return { ok: true, json: async () => url.endsWith('/nutrition') ? { meals: [], water: [] }
      : url.endsWith('/profile') ? { name: 'Synthetic' } : url.endsWith('/coach/plan') ? { days: [] }
      : { state: {}, dailyMissions: [] } };
  });
  assert.ok((await api.preloadAppData()).every(result => result.status === 'fulfilled'));
  offline = true;
  const failed = await api.preloadAppData(true);
  assert.equal(failed[1].reason.name, 'ApiNetworkError');
  assert.match(deviceCache.get('nutrition').error, /reach the PhysiqueQuest API/);
  assert.ok(warnings.some(parts => parts.some(part => String(part).includes('/nutrition'))));
  offline = false;
  assert.ok((await api.preloadAppData(true)).every(result => result.status === 'fulfilled'));
  assert.equal(deviceCache.get('nutrition').error, '');
});

test('private chat defaults to guide-only requests and preserves consent on a same-account token refresh', async () => {
  const calls = [];
  const { api } = client(async (url, config) => {
    calls.push({ url, config });
    return calls.length === 1 ? { status: 401, ok: false, json: async () => ({ message: 'Refresh session' }) } : { ok: true, json: async () => ({ reply: 'Guide reply', sources: [] }) };
  }, { refresh: async current => ({ ...current, token: 'refreshed-access' }) });
  await api.chat([{ role: 'user', text: 'How does Coach work?' }]);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].config.headers.Authorization, 'Bearer refreshed-access');
  assert.deepEqual(JSON.parse(calls[1].config.body), { messages: [{ role: 'user', text: 'How does Coach work?' }], includePersonalData: false });
});

for (const replacement of [{ id: 'another-user' }, { sessionKey: 2 }]) {
  test(`chat is not replayed after a refresh replaces ${Object.keys(replacement)[0]}`, async () => {
    let calls = 0;
    const { api } = client(async () => { calls++; return { status: 401, ok: false, json: async () => ({ message: 'Session changed' }) }; }, {
      refresh: async current => ({ ...current, ...replacement, token: 'different-access' }),
    });
    await assert.rejects(api.chat([{ role: 'user', text: 'My private question' }], true), error => error.statusCode === 401);
    assert.equal(calls, 1);
  });
  test(`chat is not sent after a preflight refresh replaces ${Object.keys(replacement)[0]}`, async () => {
    let calls = 0;
    const { api } = client(async () => { calls++; return { ok: true, json: async () => ({}) }; }, {
      initialUser: { expiresAt: Date.now() - 1 },
      refresh: async current => ({ ...current, ...replacement, token: 'different-access' }),
    });
    await assert.rejects(api.chat([{ role: 'user', text: 'My private question' }], true), error => error.statusCode === 401);
    assert.equal(calls, 0);
  });
}

test('chat is not replayed if the API origin changes during refresh', async () => {
  let calls = 0;
  const environment = client(async () => { calls++; return { status: 401, ok: false, json: async () => ({ message: 'Connection changed' }) }; }, {
    refresh: async current => { environment.setRuntimeApiUrl('http://192.168.1.20:4000/api'); return { ...current, token: 'refreshed-access' }; },
  });
  await assert.rejects(environment.api.chat([{ role: 'user', text: 'My private question' }], true), error => error.statusCode === 401);
  assert.equal(calls, 1);
});

test('chat sends only the pathname context and composes real cancellation with its timeout', async () => {
  const controller = new AbortController();
  const calls = [];
  const environment = client(async (url, config) => {
    calls.push({ url, config });
    return new Promise((_resolve, reject) => config.signal.addEventListener('abort', () => reject(config.signal.reason), { once: true }));
  });
  const pending = environment.api.chat([{ role: 'user', text: 'How do I use this page?' }], false, '/scan/history', controller.signal);
  const rejection = assert.rejects(pending, error => error.message === 'Synthetic cancellation');
  controller.abort(new Error('Synthetic cancellation'));
  await rejection;
  assert.equal(calls.length, 1);
  assert.equal(calls[0].config.signal.aborted, true);
  assert.deepEqual(JSON.parse(calls[0].config.body), { messages: [{ role: 'user', text: 'How do I use this page?' }], includePersonalData: false, page: '/scan/history' });
  assert.equal(environment.warnings.length, 0);
});

test('an already cancelled chat is never sent or refreshed', async () => {
  const controller = new AbortController();
  controller.abort(new Error('Already stopped'));
  let requests = 0, refreshes = 0;
  const environment = client(async () => { requests++; return {}; }, { initialUser: { expiresAt: Date.now() - 1 }, refresh: async current => { refreshes++; return current; } });
  await assert.rejects(environment.api.chat([{ role: 'user', text: 'My progress' }], true, '/home', controller.signal), error => error.message === 'Already stopped');
  assert.equal(requests, 0);
  assert.equal(refreshes, 0);
});
