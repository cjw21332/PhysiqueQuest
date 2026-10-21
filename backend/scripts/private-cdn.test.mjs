import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import worker from '../deploy/private-media-worker.mjs';
test('private CDN verifies signature and expiry before reading R2', async () => {
  const key = randomBytes(32).toString('base64'), path = `/media/${'a'.repeat(64)}`, expires = String(Math.floor(Date.now() / 1000) + 60);
  const signature = createHmac('sha256', Buffer.from(key, 'base64')).update(`GET:${path}:${expires}`).digest('hex');
  let reads = 0;
  const env = { CDN_SIGNING_KEY: key, MEDIA: { get: async () => { reads++; return { body: new Uint8Array([1, 2, 3]), httpMetadata: { contentType: 'image/png' } }; } } };
  const valid = `https://cdn.example.invalid${path}?expires=${expires}&signature=${signature}`;
  assert.equal((await worker.fetch(new Request(valid), env)).status, 200);
  assert.equal((await worker.fetch(new Request(valid.replace(signature, 'b'.repeat(64))), env)).status, 404);
  assert.equal((await worker.fetch(new Request(valid.replace(expires, '1000000000')), env)).status, 404);
  assert.equal((await worker.fetch(new Request(valid, { headers: { Origin: 'https://attacker.example.invalid' } }), env)).status, 404);
  assert.equal(reads, 1);
});
