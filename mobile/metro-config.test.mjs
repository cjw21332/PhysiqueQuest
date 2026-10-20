import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const config = require('./metro.config.js');
const mobile = path.dirname(fileURLToPath(import.meta.url));

test('Metro can see every shared source imported by the native camera entry points', () => {
  const roots = [config.projectRoot, ...config.watchFolders];
  const imports = ['App.tsx', 'NativeTrackingCamera.tsx'].flatMap(file =>
    [...readFileSync(path.join(mobile, file), 'utf8').matchAll(/from ['"](\.\.\/shared\/[^'"]+)['"]/g)].map(match => match[1]));
  assert.ok(imports.length > 0, 'expected native shared imports');
  for (const specifier of new Set(imports)) {
    const source = path.resolve(mobile, `${specifier}.ts`);
    assert.ok(existsSync(source), `missing source: ${specifier}`);
    assert.ok(roots.some(root => {
      const relative = path.relative(root, source);
      return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
    }), `${specifier} is outside Metro's file map`);
  }
});
