import { randomBytes } from 'node:crypto';
import { cdnDownloadUrl } from '../src/storage/cdn.js';
import worker from '../deploy/private-media-worker.mjs';
describe('private CDN URL contract', () => {
  it('keeps the storage fallback when disabled and fails closed for incomplete configuration', () => {
    expect(cdnDownloadUrl('a'.repeat(64), {})).toBeUndefined();
    expect(() => cdnDownloadUrl('a'.repeat(64), { CDN_BASE_URL: 'https://cdn.example.invalid' })).toThrow();
  });
  it('signs a URL the edge can verify and bounds it by the original retention deadline', async () => {
    const env = { CDN_BASE_URL: 'https://cdn.example.invalid', CDN_SIGNING_KEY: randomBytes(32).toString('base64') };
    const maximum = new Date(Date.now() + 10_000), key = 'a'.repeat(64);
    const url = new URL(cdnDownloadUrl(key, env, maximum)!);
    expect(Number(url.searchParams.get('expires')) * 1000).toBeLessThanOrEqual(maximum.getTime());
    const get = vi.fn(async () => ({ body: new Uint8Array([1]), httpMetadata: { contentType: 'image/png' } }));
    const response = await worker.fetch(new Request(url), { ...env, MEDIA: { get } });
    expect(response.status).toBe(200); expect(get).toHaveBeenCalledWith(`media/${key}`);
  });
});
