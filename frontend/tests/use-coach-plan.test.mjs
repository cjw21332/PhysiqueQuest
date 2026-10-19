import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { createDeviceCache } from '../lib/deviceCache.mjs';

test('a slower old request cannot overwrite the Coach program after a profile invalidation', async () => {
  const state = []; let cursor = 0, effect;
  const pending = [];
  const react = {
    useState(initial) { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = value; }]; },
    useCallback(fn) { return fn; }, useLayoutEffect(fn) { effect = fn; },
  };
  const cache = createDeviceCache({ context: () => ({ scope: 'test:user', session: 'test' }), storage: () => undefined });
  const api = { getCoachPlan(force) { return cache.fetch('coach', () => new Promise(resolve => pending.push(resolve)), force); } };
  const resourceSource = await readFile(new URL('../hooks/useAppResource.ts', import.meta.url), 'utf8');
  const coachSource = await readFile(new URL('../hooks/useCoachPlan.ts', import.meta.url), 'utf8');
  const compile = (source, imports) => {
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    const module = { exports: {} };
    new Function('require', 'module', 'exports', compiled)(name => imports[name], module, module.exports);
    return module.exports;
  };
  const resource = compile(resourceSource, { react, '../lib/api': { deviceCache: cache }, '../lib/session': { AUTH_STORAGE_KEY: 'physiquequest-auth' } });
  const hook = compile(coachSource, { '../lib/api': { api }, './useAppResource': resource });
  const oldWindow = globalThis.window, oldDocument = globalThis.document;
  globalThis.window = { addEventListener() {}, removeEventListener() {}, setInterval() { return 0; }, clearInterval() {} };
  globalThis.document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };
  let cleanup;
  try {
    const render = () => { cursor = 0; return hook.useCoachPlan(); };
    render(); cleanup = effect();
    await Promise.resolve();
    cache.invalidate('coach');
    await Promise.resolve();
    pending[1]({ goal: 'latest bodyweight plan' });
    await new Promise(resolve => setImmediate(resolve));
    pending[0]({ goal: 'obsolete dumbbell plan' });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(render().plan.goal, 'latest bodyweight plan');
    assert.equal(render().loading, false);
  } finally {
    cleanup?.(); globalThis.window = oldWindow; globalThis.document = oldDocument;
  }
});
