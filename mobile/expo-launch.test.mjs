import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const mobileRoot = dirname(fileURLToPath(import.meta.url));
const { resolveOptionsAsync } = require('../node_modules/expo/node_modules/@expo/cli/build/src/start/resolveOptions.js');

test('ordinary mobile commands resolve to Expo Go even with a development client installed', async () => {
  const { scripts } = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));
  for (const command of [scripts.start, scripts.expo]) {
    const args = Object.fromEntries(command.split(' ').filter(value => value.startsWith('--')).map(value => [value, true]));
    assert.equal((await resolveOptionsAsync(mobileRoot, args)).devClient, false);
  }
  const trackingArgs = Object.fromEntries(scripts['start:tracking'].split(' ').filter(value => value.startsWith('--')).map(value => [value, true]));
  assert.equal((await resolveOptionsAsync(mobileRoot, trackingArgs)).devClient, true);
});

test('Expo Go never probes or imports the custom pose module during app startup', async () => {
  const sharedSource = await readFile(new URL('../shared/cameraReadiness.ts', import.meta.url), 'utf8');
  const sharedOutput = ts.transpileModule(sharedSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const sharedModule = { exports: {} };
  new Function('module', 'exports', sharedOutput)(sharedModule, sharedModule.exports);
  const source = await readFile(new URL('./NativeTrackingCamera.tsx', import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  let nativeImports = 0;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)(name => {
    if (name === 'expo') return { isRunningInExpoGo: () => true, requireOptionalNativeModule() { throw new Error('Expo Go should skip the custom module probe'); } };
    if (name === 'expo-mediapipe-pose') { nativeImports++; throw new Error('Custom native module unavailable'); }
    if (name === 'expo-asset') return { Asset: {} };
    if (name === 'react-native') return {};
    if (name.endsWith('/repCounter')) return { jointIndices() {} };
    if (name.endsWith('/cameraReadiness')) return sharedModule.exports;
    return require(name);
  }, module, module.exports);
  assert.equal(module.exports.nativePoseAvailable, false);
  assert.equal(nativeImports, 0);
});
