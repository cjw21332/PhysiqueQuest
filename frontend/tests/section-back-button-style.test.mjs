import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('section back controls render as icon-only buttons without circular surfaces', async () => {
  const styles = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');
  const coachBackRules = [...styles.matchAll(/\.coach-back\s*\{([^}]*)\}/g)].map(([, rule]) => rule);
  const coachBackHoverRules = [...styles.matchAll(/\.coach-back:hover\s*\{([^}]*)\}/g)].map(([, rule]) => rule);
  const backgrounds = coachBackRules.flatMap(rule => [...rule.matchAll(/background:\s*([^;]+)/g)].map(([, value]) => value.trim()));

  assert.ok(coachBackRules.length > 0);
  assert.ok(coachBackRules.every(rule => !/border-radius:\s*50%/.test(rule)));
  assert.ok(backgrounds.every(value => value === 'transparent'));
  assert.ok(coachBackHoverRules.every(rule => /background:\s*transparent/.test(rule)));
  assert.match(styles, /\.coach-back:focus-visible\s*\{\s*outline:\s*2px solid var\(--green-dark\)/);
  assert.match(styles, /\.coach-back\s*\{[^}]*min-width:\s*44px/s);
});
