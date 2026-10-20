import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../lib/requestKey.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
function load(crypto) {
  const module = { exports: {} };
  new Function('globalThis', 'module', 'exports', js)({ crypto }, module, module.exports);
  return module.exports.createRequestKey;
}
test('request keys work with UUID, HTTP-only crypto, and no crypto object', () => {
  assert.equal(load({ randomUUID: () => 'native-uuid' })(), 'native-uuid');
  assert.equal(load({ getRandomValues: bytes => bytes.fill(42) })(), `workout-${'2a'.repeat(16)}`);
  const fallback = load(undefined);
  const keys = new Set(Array.from({ length: 100 }, () => fallback()));
  assert.equal(keys.size, 100);
  for (const key of keys) assert.ok(key.length >= 8 && key.length <= 100);
});
