import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

test('a slower old profile request cannot overwrite the latest Coach program', async () => {
  const state = [], refs = []; let cursor = 0, refCursor = 0, effect;
  const pending = [];
  const react = {
    useState(initial) { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = value; }]; },
    useRef(initial) { const index = refCursor++; return refs[index] ?? (refs[index] = { current: initial }); },
    useCallback(fn) { return fn; }, useEffect(fn) { effect = fn; },
  };
  const api = { getCoachPlan() { return new Promise((resolve, reject) => pending.push({ resolve, reject })); } };
  const source = await readFile(new URL('../hooks/useCoachPlan.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(name => name === 'react' ? react : { api }, module, module.exports);
  const render = profile => { cursor = 0; refCursor = 0; return module.exports.useCoachPlan(profile); };
  render({ equipment: ['Dumbbells'] }); const cleanup = effect();
  cleanup?.();
  render({ equipment: ['Bodyweight'] }); effect();
  pending[1].resolve({ goal: 'latest bodyweight plan' });
  await new Promise(resolve => setImmediate(resolve));
  pending[0].resolve({ goal: 'obsolete dumbbell plan' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(render({}).plan.goal, 'latest bodyweight plan');
  assert.equal(render({}).loading, false);
});
