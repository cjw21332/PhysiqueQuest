import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRepDb, REPDB_REVISION } from '../lib/repdb-normalize.mjs';
const row = () => ({ id: 'fixture-squat', name_en: 'Fixture squat', body_part: 'upper_legs', equipment: null, is_bodyweight: true, difficulty: 'beginner', instructions_en: ['Stand in position.', 'Complete the movement.'], images: { flat: { start: 'images/flat/fixture-squat-start.webp', peak: 'images/flat/fixture-squat-peak.webp' } }, met: 99, tags: ['knee_safe'] });
const data = exercise => ({ schema_version: 3, count: 1, exercises: [exercise] });
test('RepDB records retain source identity, manual labels and pinned still illustrations', () => {
  const [record] = normalizeRepDb(data(row()));
  assert.equal(record._id, 'repdb-fixture-squat'); assert.equal(record.group, 'Legs'); assert.equal(record.equipment, 'Bodyweight');
  assert.equal(record.trackingStatus, 'Manual'); assert.equal(record.gifUrl, '');
  assert.equal(record.illustrations.length, 2); assert.ok(record.illustrations.every(image => image.url.includes(REPDB_REVISION) && image.url.endsWith('.webp')));
  assert.equal(record.met, undefined); assert.equal(record.tags, undefined);
});
test('RepDB importer rejects duplicate IDs and non-free image paths instead of substituting data', () => {
  const invalid = row(); invalid.images.flat.start = 'premium-samples/fixture.webp';
  assert.throws(() => normalizeRepDb(data(invalid)), /illustration path/);
  assert.throws(() => normalizeRepDb({ schema_version: 3, count: 2, exercises: [row(), row()] }), /Invalid RepDB/);
  const missing = row(); missing.is_bodyweight = false;
  assert.equal(normalizeRepDb(data(missing))[0].equipment, 'Equipment not specified');
});
