import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Run the real hook with a minimal React scheduler and an API boundary double.
async function settingsHook(savedValues) {
  const states = [];
  let cursor = 0;
  let effect;
  let saved;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], value => { states[index] = value; }];
    },
    useCallback: fn => fn,
    useEffect: fn => { effect = fn; },
  };
  const api = {
    getSettings: async () => ({ values: savedValues }),
    updateSettings: async patch => {
      saved = { ...savedValues, ...patch };
      return { values: saved };
    },
  };
  const module = { exports: {} };
  const { outputText } = ts.transpileModule(readFileSync(new URL('../hooks/useSettings.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  });
  new Function('require', 'module', 'exports', outputText)(name => name === 'react' ? react : { api }, module, module.exports);
  const render = () => { cursor = 0; return module.exports.useSettings(); };
  const initial = render();
  effect();
  await new Promise(resolve => setImmediate(resolve));
  return { initial, render, get saved() { return saved; } };
}

test('new accounts and accounts without a saved threshold default to 30 seconds', async () => {
  for (const values of [undefined, {}, { showLeaderboard: false }]) {
    const hook = await settingsHook(values);
    assert.equal(hook.initial.settings.threshold, 30);
    assert.equal(hook.render().settings.threshold, 30);
  }
});

test('saved preferences survive loading and users can change the threshold', async () => {
  for (const threshold of [30, 45, 60]) {
    const hook = await settingsHook({ threshold, showLeaderboard: false });
    assert.equal(hook.render().settings.threshold, threshold);
    await hook.render().updateSettings({ threshold: 60 });
    assert.equal(hook.render().settings.threshold, 60);
    assert.equal(hook.saved.showLeaderboard, false);
  }
});
