import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const recordPath = new URL('../../.planning/phases/01-camera-readiness/01-CALIBRATION.json', import.meta.url);
const policySource = readFileSync(new URL('../../shared/cameraReadiness.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(policySource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const module = { exports: {} };
new Function('exports', 'module', compiled)(module.exports, module);
const policy = module.exports.readinessPolicy;
const cases = ['front-back', 'orientation', 'cover-crop-mirror', 'entry-exit-clipping', 'body-diversity', 'side-bent-occlusion', 'lighting-cover', 'permissions-busy', 'background-lock', 'switch-exit-reopen', 'model-worker-failure', 'slow-thermal', 'screen-reader', 'font-scale-targets', 'manual-continuation'];
const checks = ['fullBody', 'lighting', 'framing'];
const load = () => JSON.parse(readFileSync(recordPath, 'utf8'));

// This is an evidence guard, not a claim that a schema can verify physical observations.
function validate(record, currentPolicy = policy) {
  assert.equal(record.schemaVersion, 1);
  assert.ok(['pending', 'calibrated', 'unavailable'].includes(record.status));
  assert.equal(record.mediaStored, false);
  assert.equal(record.trials.length, new Set(record.trials.map(t => t.id)).size);
  const forbidden = /^(images?|videos?|mediaBase64|landmarks|credentials|participantName|email)$/i;
  const scan = value => { if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) { assert.ok(!forbidden.test(key), `private evidence field: ${key}`); scan(child); } };
  scan(record);
  for (const surface of ['web', 'android', 'ios']) {
    const device = record.devices.find(d => d.surface === surface);
    assert.ok(device, `missing surface ${surface}`);
    assert.equal(typeof device.tested, 'boolean');
    assert.ok(['pending', 'tested', 'unavailable'].includes(device.status));
    if (device.tested) {
      assert.equal(device.status, 'tested');
      for (const key of ['model', 'os', 'buildRevision', 'capability']) assert.ok(typeof device[key] === 'string' && device[key].trim(), `missing ${key}`);
    } else assert.notEqual(device.status, 'tested');
    for (const caseId of cases) {
      const trial = record.trials.find(t => t.deviceId === device.id && t.caseId === caseId);
      assert.ok(trial, `missing ${surface}/${caseId}`);
      assert.ok(['pending', 'pass', 'fail', 'unavailable'].includes(trial.status));
      if (['pass', 'fail'].includes(trial.status)) {
        assert.equal(device.tested, true, 'untested device cannot pass/fail');
        assert.ok(typeof trial.observation === 'string' && trial.observation.trim());
        assert.equal(typeof trial.falseGreen, 'boolean');
        if (trial.status === 'pass') assert.equal(trial.falseGreen, false);
      }
    }
  }
  assert.ok(Number.isFinite(currentPolicy.confidence) && currentPolicy.confidence > 0 && currentPolicy.confidence <= 1);
  assert.ok(Number.isFinite(currentPolicy.margin) && currentPolicy.margin >= 0 && currentPolicy.margin < .5);
  for (const band of [currentPolicy.heightBand, ...(currentPolicy.lightingBand ? [currentPolicy.lightingBand] : [])]) {
    assert.equal(band.length, 2);
    assert.ok(band.every(Number.isFinite) && band[0] >= 0 && band[0] < band[1] && band[1] <= 1, 'invalid calibration range');
  }
  for (const key of ['dwellMs', 'expiryMs', 'samplingMs', 'initializationMs', 'inferenceTimeoutMs']) assert.ok(Number.isFinite(currentPolicy[key]) && currentPolicy[key] > 0 && currentPolicy[key] <= 60000, `invalid ${key}`);
  assert.ok(currentPolicy.samplingMs <= currentPolicy.expiryMs);
  for (const platform of ['web', 'native']) for (const check of checks) {
    const decision = record.decisions.find(d => d.platform === platform && d.check === check);
    assert.ok(decision, `missing decision ${platform}/${check}`);
    assert.ok(['pending', 'calibrated', 'unavailable'].includes(decision.status));
    assert.ok(Array.isArray(decision.trialIds));
    if (!currentPolicy.calibrated[platform][check] && decision.status !== 'calibrated') continue;
    assert.equal(decision.status, 'calibrated', 'enabled flag requires calibrated decision');
    const keys = ['dwellMs', 'expiryMs', 'samplingMs', 'initializationMs', 'inferenceTimeoutMs', ...(check === 'lighting' ? ['lightingBand'] : ['confidence', 'margin', 'allowEarHead', ...(check === 'framing' ? ['heightBand'] : [])])];
    for (const key of keys) { assert.notEqual(currentPolicy[key], undefined); assert.deepEqual(decision.values?.[key], currentPolicy[key], `policy disagreement: ${key}`); }
    // Native flags cover both OSes; one phone cannot authorize a global native flag.
    for (const surface of platform === 'web' ? ['web'] : ['android', 'ios']) {
      const device = record.devices.find(d => d.surface === surface);
      assert.equal(device.tested, true);
      for (const caseId of cases) {
        const trial = record.trials.find(t => t.deviceId === device.id && t.caseId === caseId);
        assert.ok(decision.trialIds.includes(trial.id), `missing trial provenance ${surface}/${caseId}`);
        assert.equal(trial.status, 'pass', 'unresolved device trial cannot authorize a flag');
      }
    }
    assert.ok(decision.trialIds.every(id => record.trials.some(t => t.id === id)), 'unknown trial ID');
  }
  if (record.status === 'calibrated') assert.ok(record.devices.every(d => d.tested) && record.trials.every(t => t.status === 'pass') && record.decisions.every(d => d.status === 'calibrated'));
}

test('calibration evidence accepts a complete pending matrix and unresolved flags stay disabled', () => {
  const record = load(); validate(record);
  for (const decision of record.decisions) if (decision.status !== 'calibrated') assert.equal(policy.calibrated[decision.platform][decision.check], false);
});
test('calibration guard rejects unsupported versions, private evidence, missing matrix rows and invented hardware passes', () => {
  for (const mutate of [r => r.schemaVersion++, r => r.images = ['private'], r => r.trials.pop(), r => r.trials[0].status = 'pass']) {
    const record = load(); mutate(record); assert.throws(() => validate(record));
  }
});
test('calibration guard rejects missing trial support, numeric ranges and policy disagreement', () => {
  const record = load(), enabled = structuredClone(policy); enabled.calibrated.web.fullBody = true;
  assert.throws(() => validate(record, enabled));
  const decision = record.decisions.find(d => d.platform === 'web' && d.check === 'fullBody');
  decision.status = 'calibrated'; decision.values = structuredClone(enabled); decision.trialIds = ['invented'];
  assert.throws(() => validate(record, enabled));
  for (const changes of [{ confidence: NaN }, { margin: .6 }, { heightBand: [.85, .55] }, { lightingBand: [-1, 2] }, { dwellMs: -1 }, { samplingMs: 0 }, { expiryMs: Infinity }]) assert.throws(() => validate(load(), { ...policy, ...changes }));
});

test('synthetic validator fixture accepts supported values then rejects mismatches and unresolved native OS coverage', () => {
  // Fabricated inputs exist only inside this test; never write them into device evidence.
  const record = load(), enabled = structuredClone(policy); enabled.calibrated.web.fullBody = true;
  Object.assign(record.devices[0], { tested: true, status: 'tested', model: 'synthetic validator fixture', os: 'test', buildRevision: 'test', capability: 'test' });
  for (const trial of record.trials.filter(t => t.deviceId === record.devices[0].id)) Object.assign(trial, { status: 'pass', observation: 'synthetic validator fixture', falseGreen: false });
  const decision = record.decisions.find(d => d.platform === 'web' && d.check === 'fullBody');
  Object.assign(decision, { status: 'calibrated', values: { ...enabled }, trialIds: record.trials.filter(t => t.deviceId === record.devices[0].id).map(t => t.id) });
  validate(record, enabled);
  decision.values.confidence = .9; assert.throws(() => validate(record, enabled), /policy disagreement/);
  decision.values.confidence = enabled.confidence; decision.trialIds.pop(); assert.throws(() => validate(record, enabled), /missing trial provenance/);
  decision.trialIds = record.trials.filter(t => t.deviceId === record.devices[0].id).map(t => t.id);
  enabled.calibrated.native.fullBody = true;
  Object.assign(record.decisions.find(d => d.platform === 'native' && d.check === 'fullBody'), { status: 'calibrated', values: { ...enabled }, trialIds: [] });
  assert.throws(() => validate(record, enabled), /false !== true/);
});
