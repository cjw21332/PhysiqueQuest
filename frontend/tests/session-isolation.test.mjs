import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
test('logout clears profile and account drafts while retaining unrelated device settings', async () => {
  const oldWindow = globalThis.window, oldStorage = globalThis.localStorage;
  const storage = { 'physiquequest-auth': 'A', 'physiquequest-profile': 'profile-A', 'physiquequest-draft:A:recorded': 'pending', 'physiquequest-draft:A:workout': 'reps', 'device-theme': 'light' };
  Object.defineProperty(storage, 'removeItem', { value: key => { delete storage[key]; } });
  globalThis.window = new EventTarget(); globalThis.localStorage = storage;
  try {
    let cleared = 0; window.addEventListener('physiquequest:session-cleared', () => cleared++);
    const source = await readFile(new URL('../lib/session.ts', import.meta.url), 'utf8');
    const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    const { clearAuthSession } = await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
    clearAuthSession();
    assert.deepEqual(Object.keys(storage), ['device-theme']); assert.equal(cleared, 1);
  } finally { globalThis.window = oldWindow; globalThis.localStorage = oldStorage; }
});
