import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
const source = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
test('local camera keeps explicit upload provider status and reports never fabricate a score', async () => {
  const camera = await source('sections/Coach/CameraCheck.tsx');
  const api = await source('lib/api.ts');
  const report = await source('sections/Coach/WorkoutReport.tsx');
  assert.match(camera, /getPoseStatus/);
  // The screen is upload-only now, so there is no capture mode to guard.
  assert.match(camera, /api\.analyzePose\(\{ mediaBase64, mimeType, analysisType: 'workout', durationSeconds:/);
  assert.doesNotMatch(camera, /analysisType: 'readiness'/);
  assert.match(camera, /Video analysis is temporarily unavailable/);
  assert.match(api, /\/pose\/status/);
  assert.doesNotMatch(report, /form score/i);
  assert.doesNotMatch(report, /\d+%/);
});
