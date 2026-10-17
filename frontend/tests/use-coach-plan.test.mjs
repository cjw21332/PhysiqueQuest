import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

test('shared resources deduplicate reads, reject stale responses after mutation and isolate accounts', async () => {
  const oldWindow = globalThis.window, oldDocument = globalThis.document, oldStorage = globalThis.localStorage;
  const values = new Map([['physiquequest-auth', JSON.stringify({ id: 'A', token: 'token-A' })]]);
  globalThis.localStorage = { getItem: key => values.get(key) ?? null };
  globalThis.window = new EventTarget();
  globalThis.document = { hidden: false };
  try {
    let current;
    const react = {
      useState(initial) { const target = current, index = target.cursor++; if (!(index in target.values)) target.values[index] = initial; return [target.values[index], value => { target.values[index] = value; }]; },
      useRef(initial) { const target = current, index = target.cursor++; return target.values[index] ?? (target.values[index] = { current: initial }); },
      useCallback(fn) { return fn; }, useEffect(fn) { current.effect = fn; },
    };
    const source = await readFile(new URL('../hooks/useApiResource.ts', import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const module = { exports: {} };
    new Function('require', 'module', 'exports', compiled)(() => react, module, module.exports);
    const pending = [], cleanups = [];
    const loader = () => new Promise(resolve => pending.push(resolve));
    const mount = () => {
      const target = { values: [], cursor: 0 };
      const render = () => { current = target; target.cursor = 0; return module.exports.useApiResource('coach-plan', loader); };
      render(); cleanups.push(target.effect()); return render;
    };
    const first = mount(), second = mount();
    assert.equal(pending.length, 1);
    module.exports.notifyDataChanged('coach-plan');
    pending[0]({ goal: 'obsolete plan' }); await new Promise(resolve => setImmediate(resolve));
    assert.equal(pending.length, 2);
    assert.equal(first().data, undefined);
    pending[1]({ goal: 'current plan' }); await new Promise(resolve => setImmediate(resolve));
    assert.equal(first().data.goal, 'current plan'); assert.equal(second().data.goal, 'current plan');
    const cached = mount(); assert.equal(cached().data.goal, 'current plan'); assert.equal(pending.length, 2);
    values.delete('physiquequest-auth'); window.dispatchEvent(new Event('physiquequest:session-cleared'));
    assert.equal(first().data, undefined);
    values.set('physiquequest-auth', JSON.stringify({ id: 'B', token: 'token-B' }));
    const another = mount(); assert.equal(pending.length, 3); assert.equal(another().data, undefined);
    pending[2]({ goal: 'account B plan' }); await new Promise(resolve => setImmediate(resolve));
    assert.equal(another().data.goal, 'account B plan'); assert.equal(first().data, undefined);
    cleanups.forEach(cleanup => cleanup?.());
  } finally { globalThis.window = oldWindow; globalThis.document = oldDocument; globalThis.localStorage = oldStorage; }
});
