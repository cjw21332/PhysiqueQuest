import assert from 'node:assert/strict';
import test from 'node:test';
import { healthPatch } from '../lib/healthProfile.ts';

test('one health checklist fills conditions always and injuries/health risks only with consent', () => {
  const selected = ['Knee injury', 'Asthma', 'Old ankle sprain'];
  assert.deepEqual(healthPatch(selected, '2026-11-28T00:00:00Z', ['Old ankle sprain'], []), {
    conditions: selected, injuries: ['Knee injury', 'Old ankle sprain'], healthRisks: ['Asthma'],
  });
  assert.deepEqual(healthPatch(selected, null, ['Old ankle sprain'], []), { conditions: selected, injuries: [], healthRisks: [] });
  assert.deepEqual(healthPatch(['None of these'], '2026-11-28T00:00:00Z'), { conditions: ['None of these'], injuries: [], healthRisks: [] });
});
