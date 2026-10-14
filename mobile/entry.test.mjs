import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { resolveEntryPoint } = require('@expo/config/paths');
const mobileRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(mobileRoot, '..');

test('Android entry resolves to the mobile app when Expo starts at the repository root', () => {
  assert.equal(resolveEntryPoint(repositoryRoot, { platform: 'android' }), resolve(mobileRoot, 'index.ts'));
});

test('Android entry resolves to the same mobile app when Expo starts in its workspace', () => {
  assert.equal(resolveEntryPoint(mobileRoot, { platform: 'android' }), resolve(mobileRoot, 'index.ts'));
});
