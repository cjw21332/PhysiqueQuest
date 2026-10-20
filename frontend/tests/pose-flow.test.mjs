import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
const source = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
test('local camera keeps explicit upload provider status and reports never fabricate a score', async () => {
  const camera = await source('sections/Coach/CameraCheck.tsx');
  const api = await source('lib/api.ts');
  const report = await source('sections/Coach/WorkoutReport.tsx');
  assert.match(camera, /getPoseStatus/);
  assert.match(camera, /if \(mode !== 'upload'\) return/);
  assert.match(camera, /api\.analyzePose\(\{ mediaBase64, mimeType \}\)/);
  assert.doesNotMatch(camera, /analysisType: 'readiness'/);
  assert.match(camera, /Pose analysis is not configured/);
  assert.match(api, /\/pose\/status/);
  assert.match(report, /Form analysis.*unavailable/i);
  assert.doesNotMatch(report, /\d+%/);
});
