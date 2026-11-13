import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

test('UI source has no replacement characters or common damaged UTF-8 sequences', () => {
  const invalid = [];
  function scan(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) scan(path);
      else if (/\.(tsx?|css)$/.test(path)) {
        if (/[\ufffd\u0080-\u009f]|\u00c3[\u0080-\u00bf\u2014]|\u00c2\u00b7|\u00e2\u20ac|\u00ef\u00bc/u.test(readFileSync(path, 'utf8'))) invalid.push(path);
      }
    }
  }
  for (const path of ['app', 'components', 'sections']) scan(fileURLToPath(new URL(`../${path}`, import.meta.url)));
  assert.deepEqual(invalid, []);
});
