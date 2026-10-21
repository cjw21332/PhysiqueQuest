import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { withCircuit } from '../common/outbound.js';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export interface StorageProvider {
  uploadUrl(key: string, contentType: string, size: number): Promise<string>;
  downloadUrl(key: string): Promise<string>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}
export function validObjectKey(key: string) { return /^[a-f0-9]{64}$/.test(key); }
export class LocalStorageProvider implements StorageProvider {
  readonly root: string;
  constructor(root: string, private readonly secret: string) { this.root = resolve(root); }
  private path(key: string) { if (!validObjectKey(key)) throw new Error('Invalid object key'); return join(this.root, key); }
  private signature(method: string, key: string, expires: string) { return createHmac('sha256', this.secret).update(`${method}:${key}:${expires}`).digest('hex'); }
  authorize(method: string, key: string, expires: string, signature: string) {
    if (!validObjectKey(key) || !/^\d{13}$/.test(expires) || !/^[a-f0-9]{64}$/.test(signature) || Number(expires) < Date.now() || Number(expires) > Date.now() + 901_000) return false;
    return timingSafeEqual(Buffer.from(signature), Buffer.from(this.signature(method, key, expires)));
  }
  private url(method: string, key: string) { const expires = String(Date.now() + (method === 'PUT' ? 900_000 : 60_000)); return `/api/storage/local/${key}/${expires}/${this.signature(method, key, expires)}`; }
  async uploadUrl(key: string) { this.path(key); return this.url('PUT', key); }
  async downloadUrl(key: string) { this.path(key); return this.url('GET', key); }
  async write(key: string, bytes: Buffer) { if (bytes.length > MAX_UPLOAD_BYTES) throw new Error('Upload too large'); await mkdir(this.root, { recursive: true }); await writeFile(this.path(key), bytes, { flag: 'wx', mode: 0o600 }); }
  async read(key: string) { return readFile(this.path(key)); }
  async delete(key: string) { try { await unlink(this.path(key)); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; } }
}
export class S3StorageProvider implements StorageProvider {
  readonly client: S3Client;
  private readonly bucket: string;
  constructor(env = process.env) {
    this.bucket = env.S3_BUCKET!;
    this.client = new S3Client({ region: env.S3_REGION || 'auto', endpoint: env.S3_ENDPOINT || undefined, maxAttempts: 3, requestHandler: { requestTimeout: 10_000, connectionTimeout: 5000 },
      forcePathStyle: env.S3_FORCE_PATH_STYLE === 'true', credentials: env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY } : undefined });
  }
  private object(key: string) { if (!validObjectKey(key)) throw new Error('Invalid object key'); return { Bucket: this.bucket, Key: `media/${key}` }; }
  async uploadUrl(key: string, ContentType: string, ContentLength: number) { return getSignedUrl(this.client, new PutObjectCommand({ ...this.object(key), ContentType, ContentLength, IfNoneMatch: '*' }), { expiresIn: 900, signableHeaders: new Set(['content-type', 'content-length', 'if-none-match']) }); }
  async downloadUrl(key: string) { return getSignedUrl(this.client, new GetObjectCommand({ ...this.object(key), ResponseContentDisposition: 'attachment' }), { expiresIn: 60 }); }
  async read(key: string) {
    const object = await withCircuit('s3-storage', () => this.client.send(new GetObjectCommand(this.object(key))));
    if (!object.Body || (object.ContentLength ?? MAX_UPLOAD_BYTES + 1) > MAX_UPLOAD_BYTES) throw new Error('Invalid upload size');
    const chunks: Buffer[] = []; let size = 0;
    for await (const chunk of object.Body as AsyncIterable<Uint8Array>) {
      size += chunk.length;
      if (size > MAX_UPLOAD_BYTES) { (object.Body as { destroy?: () => void }).destroy?.(); throw new Error('Invalid upload size'); }
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  async delete(key: string) { await withCircuit('s3-storage', () => this.client.send(new DeleteObjectCommand(this.object(key)))); }
}
