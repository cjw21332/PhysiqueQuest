import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('text fields avoid the extra focus outline while interactive controls retain focus visibility', async () => {
  const styles = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(styles, /:is\(button, a, summary\):focus-visible\s*\{\s*outline:\s*2px solid var\(--green-dark\)/);
  assert.match(styles, /textarea, select\):focus\s*\{\s*outline: none;\s*outline-offset: 0;\s*box-shadow: none;\s*border-color: var\(--green\);/);
  assert.match(styles, /:is\(\.input-wrap, \.focus-within, \.library-search, \.food-search, \.admin-search\):focus-within\s*\{\s*outline: none;\s*box-shadow: none;\s*border-color: var\(--green\);/);
  assert.match(styles, /html\s*\{\s*-webkit-tap-highlight-color: transparent;/);
  assert.doesNotMatch(styles, /:is\(button, a\[href\], input, select, textarea, summary\):focus-visible/);
});
