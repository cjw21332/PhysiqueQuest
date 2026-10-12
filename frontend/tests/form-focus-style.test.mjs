import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('text fields avoid the extra focus outline while interactive controls retain focus visibility', async () => {
  const styles = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(styles, /:is\(button, a, summary\):focus-visible\s*\{\s*outline:\s*2px solid var\(--green-dark\)/);
  assert.match(styles, /:is\(input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\):not\(\[type="file"\]\)\):focus-visible,\s*:is\(select, textarea\):focus,\s*:is\(select, textarea\):focus-visible\s*\{\s*outline:\s*none;/);
  assert.match(styles, /:is\(\.input-wrap, \.focus-within\):focus-within,\s*textarea:focus\s*\{\s*outline:\s*none;/);
});
