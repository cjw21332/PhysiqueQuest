import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function load() {
  const source = await readFile(new URL('../lib/scanSaveRecovery.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', js)(name => name === './api' ? { getApiBaseUrl: () => 'https://example.test/api' } : { session: { current: () => ({ id: 'user' }) } }, module, module.exports);
  return module.exports;
}
test('persists the same save across reload and blocks changed payloads', async () => {
  const map = new Map(); globalThis.localStorage = { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) };
  const a = await load(), scope = a.scanSaveScope(), items = [{ food_name: 'rice' }];
  const original = a.beginPendingScanSave(scope, 'Dinner', items, '2026-11-15', '12:00');
  const reloaded = await load();
  assert.deepEqual(reloaded.readPendingScanSave(scope), original);
  assert.deepEqual(reloaded.beginPendingScanSave(scope, 'Dinner', items, '2026-11-16', '13:00'), original);
  assert.throws(() => reloaded.beginPendingScanSave(scope, 'Lunch', items, '2026-11-15', '12:00'), /unknown outcome/);
  assert.equal(reloaded.readPendingScanSave('another-user'), null);
  reloaded.clearPendingScanSave(scope, 'wrong'); assert.ok(reloaded.readPendingScanSave(scope));
  reloaded.clearPendingScanSave(scope, original.key); assert.equal(reloaded.readPendingScanSave(scope), null);
  delete globalThis.localStorage;
});
test('fails before a request if durable storage cannot write', async () => {
  globalThis.localStorage = { getItem: () => null, setItem: () => { throw new Error('storage unavailable'); } };
  const recovery = await load();
  assert.throws(() => recovery.beginPendingScanSave('scope', 'Dinner', [], '2026-11-15', '12:00'), /storage unavailable/);
  delete globalThis.localStorage;
});
