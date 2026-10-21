import { LocalStorageProvider, S3StorageProvider } from './storage-provider.js';
describe('private signed storage capabilities', () => {
  const key = 'a'.repeat(64);
  it('binds local signatures to method, object and expiry and rejects traversal', async () => {
    const provider = new LocalStorageProvider('.data/test-unused', 'test-key');
    const url = await provider.uploadUrl(key), [, , , , object, expires, signature] = url.split('/');
    expect(provider.authorize('PUT', object, expires, signature)).toBe(true);
    expect(provider.authorize('GET', object, expires, signature)).toBe(false);
    expect(provider.authorize('PUT', 'b'.repeat(64), expires, signature)).toBe(false);
    expect(provider.authorize('PUT', object, '1000000000000', signature)).toBe(false);
    await expect(provider.read('../outside')).rejects.toThrow('Invalid object key');
  });
  it('signs S3 uploads without network access and requires create-only size/type-bound writes', async () => {
    const provider = new S3StorageProvider({ S3_BUCKET: 'private-fixture', S3_REGION: 'us-east-1', S3_ENDPOINT: 'http://127.0.0.1:9000', S3_FORCE_PATH_STYLE: 'true', S3_ACCESS_KEY_ID: 'fixture', S3_SECRET_ACCESS_KEY: 'fixture-secret' });
    const upload = new URL(await provider.uploadUrl(key, 'image/png', 12));
    expect(upload.pathname).toBe(`/private-fixture/media/${key}`);
    expect(upload.searchParams.get('X-Amz-Expires')).toBe('900');
    expect(upload.searchParams.get('X-Amz-SignedHeaders')).toContain('if-none-match');
    expect(upload.searchParams.get('X-Amz-SignedHeaders')).toContain('content-length');
    expect(upload.searchParams.get('X-Amz-SignedHeaders')).toContain('content-type');
    expect(new URL(await provider.downloadUrl(key)).searchParams.get('X-Amz-Expires')).toBe('60');
    provider.client.destroy();
  });
});
