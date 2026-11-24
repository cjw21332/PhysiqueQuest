import assert from 'node:assert/strict';
import test from 'node:test';
import { CERTIFICATIONS, SUPPLEMENTS, supplementAudience } from '../lib/supplements.ts';

test('every supplement is complete, sourced and certification-checkable', () => {
  assert.ok(SUPPLEMENTS.length >= 15);
  assert.equal(new Set(SUPPLEMENTS.map(item => item.id)).size, SUPPLEMENTS.length);
  const marks = new Set(CERTIFICATIONS.map(cert => cert.mark));
  for (const item of SUPPLEMENTS) {
    for (const field of ['benefits', 'sideEffects', 'cautions', 'interactions', 'whereToBuy', 'certifications'] as const) assert.ok(item[field].length > 0, `${item.id}.${field}`);
    assert.ok(item.dose && item.timing && item.summary, item.id);
    assert.match(item.source.url, /^https:\/\/(ods\.od\.nih\.gov|www\.fda\.gov)\//, item.id);
    for (const mark of item.certifications) assert.ok(marks.has(mark), `${item.id}: ${mark}`);
  }
  // Never claim FDA or USDA "approval" of a supplement.
  assert.doesNotMatch(JSON.stringify(SUPPLEMENTS), /FDA[- ]approved|USDA[- ]approved/i);
  for (const cert of CERTIFICATIONS) assert.match(cert.check.url, /^https:\/\//);
});

test('the guide is tailored to goal, age and consented health data', () => {
  const lifter = supplementAudience({ age: '25', goal: 'Build muscle' });
  assert.ok(lifter.fits(SUPPLEMENTS.find(item => item.id === 'creatine')!));
  assert.equal(lifter.ordered[0].goals.includes('Build muscle'), true);
  assert.equal(lifter.health.length, 0);

  const teen = supplementAudience({ age: '16', goal: 'Build muscle' });
  assert.equal(teen.minor, true);
  assert.equal(teen.fits(SUPPLEMENTS.find(item => item.id === 'creatine')!), false);
  assert.equal(teen.fits(SUPPLEMENTS.find(item => item.id === 'whey')!), true);

  const older = supplementAudience({ age: '62', goal: 'Endurance' });
  assert.ok(older.fits(SUPPLEMENTS.find(item => item.id === 'b12')!));
  assert.ok(older.fits(SUPPLEMENTS.find(item => item.id === 'calcium')!));

  assert.equal(supplementAudience({ age: '30', goal: 'Strength', conditions: ['Hypertension'] }).health.length, 0);
  assert.deepEqual(supplementAudience({ age: '30', goal: 'Strength', conditions: ['Hypertension'], healthConsentAt: '2026-01-01' }).health, ['Hypertension']);
});
