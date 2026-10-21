import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { createDeviceCache } from '../lib/deviceCache.mjs';
import { resolveApiBaseUrl } from '../lib/apiBaseUrl.mjs';
import { resolveCoachBaseUrl } from '../lib/coachBaseUrl.mjs';
import * as errors from '../lib/apiErrors.mjs';

function client(fetcher) {
  const exports = {};
  const warnings = [];
  const current = { id: 'test-user', token: 'test-access', sessionKey: 1, expiresAt: Date.now() + 900_000 };
  const modules = {
    './session': { appVersionHeaders: () => ({ 'X-App-Version': '1.0.0' }), session: { current: () => current } },
    './apiBaseUrl.mjs': { resolveApiBaseUrl }, './coachBaseUrl.mjs': { resolveCoachBaseUrl },
    './deviceCache.mjs': { createDeviceCache }, './apiErrors.mjs': errors,
  };
  const output = ts.transpileModule(readFileSync(new URL('../lib/api.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(output, { exports, require: name => modules[name], fetch: fetcher, URL, URLSearchParams, Intl, AbortController,
    setTimeout, clearTimeout, TypeError, Error, process: { env: {} },
    console: { error: (...args) => warnings.push(args), warn: (...args) => warnings.push(args) },
    window: { location: { protocol: 'http:', hostname: 'localhost', port: '3000' }, localStorage: { getItem: () => null } },
  });
  return { ...exports, warnings };
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
