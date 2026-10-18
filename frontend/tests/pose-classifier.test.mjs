import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
async function load(path) { const source = await readFile(new URL(path, import.meta.url), 'utf8'); const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText; const exports = {}; new Function('exports', js)(exports); return exports; }
const { createPosePhaseClassifier, trainPosePhaseModel, poseFeatures } = await load('../../shared/poseClassifier.ts');
const { createLearnedExerciseIdentifier, trackingKinds } = await load('../../shared/repCounter.ts');
function frame(phase, timestamp = 0) {
  const joints = Array.from({ length: 33 }, () => ({ x: .5, y: .5, visibility: 1 }));
  const values = { 11: [.35, .25], 12: [.65, .25], 13: [.3, .4], 14: [.7, .4], 15: phase === 'ready' ? [.3, .55] : [.2, .2], 16: phase === 'ready' ? [.7, .55] : [.8, .2], 23: [.4, .55], 24: [.6, .55], 25: [.4, .75], 26: [.6, .75], 27: [.4, .95], 28: [.6, .95] };
  for (const [index, [x, y]] of Object.entries(values)) joints[index] = { x, y, visibility: 1 };
  return { joints, aspect: 1, timestamp };
}
const label = phase => ({ kind: 'shoulderpress', side: 'left', phase });
const options = { coordinates: 'image', neighbours: 3, maximumDistance: .05, minimumVote: .8 };
function dataset() {
  const rows = [];
  for (const groupId of ['person-a', 'person-b']) for (const phase of ['ready', 'active']) for (let i = 0; i < 3; i++) rows.push({ groupId, clipId: `${groupId}-${phase}`, split: 'train', label: label(phase), frame: frame(phase, i * 100) });
  for (const phase of ['ready', 'active']) rows.push({ groupId: 'person-c', clipId: 'heldout-c', split: 'validation', label: label(phase), frame: frame(phase) });
  const unknown = frame('ready'); unknown.joints[15].y = .85; unknown.joints[16].y = .85;
  rows.push({ groupId: 'person-d', clipId: 'unknown-d', split: 'validation', label: null, frame: unknown });
  return rows;
}
test('offline training excludes held-out frames and reports known/unknown outcomes', () => {
  const { model, report } = trainPosePhaseModel(dataset(), trackingKinds, options);
  assert.equal(model.samples.length, 12); assert.equal(report.validationFrames, 3); assert.equal(report.matched, 3); assert.equal(report.falseAccepts, 0);
  const classifier = createPosePhaseClassifier(model, trackingKinds);
  assert.equal(classifier.classify(frame('active')).phase, 'active');
  const hidden = frame('ready'); hidden.joints[15].visibility = .1; assert.equal(classifier.classify(hidden), null);
  assert.equal(poseFeatures(frame('ready'), 'world'), null);
  model.samples[0].values[0] = NaN; assert.equal(classifier.classify(frame('ready')).phase, 'ready');
});
test('trainer rejects leaked groups, missing phases and unlabeled catalog-shaped data', () => {
  const leaked = dataset(); leaked.at(-1).groupId = 'person-a'; assert.throws(() => trainPosePhaseModel(leaked, trackingKinds, options), /leakage/);
  assert.throws(() => trainPosePhaseModel(dataset().filter(row => row.split !== 'train' || row.label.phase === 'ready'), trackingKinds, options), /both ready and active/);
  assert.throws(() => trainPosePhaseModel({ exercises: [] }, trackingKinds, options), /Invalid labeled motion dataset/);
});
test('ambiguous equal-distance poses reject instead of choosing the first class', () => {
  const { model } = trainPosePhaseModel(dataset(), trackingKinds, options);
  const values = poseFeatures(frame('ready'), 'image');
  model.samples = Array.from({ length: 6 }, (_, index) => ({ label: label(index % 2 ? 'active' : 'ready'), values }));
  assert.equal(createPosePhaseClassifier(model, trackingKinds).classify(frame('ready')), null);
});
test('learned predictions use the same temporal cycle engine and require complete repetitions', () => {
  const { model } = trainPosePhaseModel(dataset(), trackingKinds, options);
  const identifier = createLearnedExerciseIdentifier(createPosePhaseClassifier(model, trackingKinds)); let timestamp = 0;
  for (const phase of ['active', 'ready', 'active', 'ready']) for (let i = 0; i < 7; i++) { identifier.update(frame(phase, timestamp)); timestamp += 100; }
  assert.equal(identifier.result()?.reps, 1); assert.equal(identifier.result()?.name, 'Overhead press'); assert.equal(identifier.result()?.equipment, '');
});
test('training CLI writes a candidate with provenance and held-out results without activating the app', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'pq-pose-cli-'));
  const input = join(folder, 'synthetic.json'), output = join(folder, 'candidate.json');
  try {
    await writeFile(input, JSON.stringify({ source: 'Synthetic contract fixture, not human accuracy evidence', license: 'Project-authored fixture', rows: dataset() }));
    execFileSync(process.execPath, [fileURLToPath(new URL('../../scripts/train-pose-classifier.mjs', import.meta.url)), input, output], { stdio: 'pipe' });
    const model = JSON.parse(await readFile(output, 'utf8'));
    assert.equal(model.version, 1); assert.equal(model.samples.length, 12); assert.equal(model.validation.validationFrames, 3);
    assert.match(model.provenance.source, /Synthetic/);
  } finally { await unlink(input).catch(() => {}); await unlink(output).catch(() => {}); await rmdir(folder); }
});
