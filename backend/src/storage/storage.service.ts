import { Injectable, Logger, NotFoundException, BadRequestException, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import type { Connection } from 'mongoose';
import { randomBytes } from 'node:crypto';
import { cdnDownloadUrl } from './cdn.js';
import { sniffImageMime } from '../foodscan/foodscan.schemas.js';
import { LocalStorageProvider, S3StorageProvider, MAX_UPLOAD_BYTES, type StorageProvider } from './storage-provider.js';

@Injectable()
export class StorageService implements OnModuleInit, OnModuleDestroy {
  readonly provider: StorageProvider;
  private readonly logger = new Logger(StorageService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  constructor(@InjectConnection() private readonly connection: Connection) {
    this.provider = process.env.STORAGE_DRIVER === 's3' ? new S3StorageProvider() : new LocalStorageProvider(process.env.STORAGE_LOCAL_DIR || '.data/uploads', process.env.JWT_SECRET!);
  }
  private get records() { return this.connection.collection('storage_uploads'); }
  async onModuleInit() {
    // Metadata must survive until object deletion succeeds; a TTL index would orphan bytes.
    if (process.env.NODE_ENV !== 'production') await Promise.all([this.records.createIndex({ userId: 1 }), this.records.createIndex({ expiresAt: 1, status: 1 })]);
    this.timer = setInterval(() => { void this.cleanup().catch(() => this.logger.error({ event: 'storage_cleanup_failed' })); }, 60_000); this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  async createUpload(userId: string, contentType: string, size: number) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType) || !Number.isInteger(size) || size < 8 || size > MAX_UPLOAD_BYTES) throw new BadRequestException('Upload must be a JPEG, PNG or WebP image of at most 5 MB');
    const key = randomBytes(32).toString('hex'), _id = new Types.ObjectId();
    const expiresAt = new Date(Date.now() + Number(process.env.ORPHAN_UPLOAD_TTL_HOURS || 24) * 3600_000);
    await this.records.insertOne({ _id, userId: new Types.ObjectId(userId), key, contentType, size, status: 'pending', createdAt: new Date(), expiresAt });
    return { id: String(_id), uploadUrl: await this.provider.uploadUrl(key, contentType, size), expiresIn: 900, contentType, headers: { 'Content-Type': contentType, ...(this.provider instanceof S3StorageProvider ? { 'If-None-Match': '*' } : {}) }, maxBytes: MAX_UPLOAD_BYTES };
  }
  private async owned(id: string, userId: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException();
    const record = await this.records.findOne({ _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId), expiresAt: { $gt: new Date() }, status: { $ne: 'deleting' } });
    if (!record) throw new NotFoundException(); return record;
  }
  async verify(id: string, userId: string) {
    const record = await this.owned(id, userId);
    const bytes = await this.provider.read(record.key);
    if (bytes.length !== record.size || sniffImageMime(bytes) !== record.contentType) {
      await this.provider.delete(record.key); throw new BadRequestException('Upload content does not match its declared image type and size');
    }
    const changed = await this.records.updateOne({ _id: record._id, userId: record.userId, status: { $ne: 'deleting' }, expiresAt: { $gt: new Date() } }, { $set: { status: record.status === 'analyzed' ? 'analyzed' : 'ready', verifiedAt: new Date() } });
    if (!changed.matchedCount) throw new NotFoundException();
    return { id, verified: true };
  }
  async download(id: string, userId: string) { const record = await this.owned(id, userId); if (!['ready', 'analyzed'].includes(record.status)) throw new BadRequestException('Upload is not verified'); return { downloadUrl: cdnDownloadUrl(record.key, process.env, record.expiresAt) || await this.provider.downloadUrl(record.key), expiresIn: 60 }; }
  async analysisInput(id: string, userId: string) {
    const record = await this.owned(id, userId);
    if (!['ready', 'analyzed'].includes(record.status)) throw new BadRequestException('Upload is not verified');
    const bytes = await this.provider.read(record.key);
    if (bytes.length !== record.size || sniffImageMime(bytes) !== record.contentType) throw new BadRequestException('Invalid upload content');
    return { image: bytes.toString('base64'), mimeType: record.contentType };
  }
  async markAnalyzed(id: string, userId: string) {
    const record = await this.owned(id, userId); if (!['ready', 'analyzed'].includes(record.status)) throw new BadRequestException('Upload is not verified');
    // Repeated completion notifications must not extend original retention.
    await this.records.updateOne({ _id: record._id, status: 'ready' }, { $set: { status: 'analyzed', analyzedAt: new Date(), expiresAt: new Date(Date.now() + Number(process.env.MEDIA_ORIGINAL_TTL_HOURS || 24) * 3600_000) } });
  }
  async readLocal(key: string) { const record = await this.records.findOne({ key, status: { $in: ['ready', 'analyzed'] }, expiresAt: { $gt: new Date() } }); if (!record) throw new NotFoundException(); return { bytes: await this.provider.read(key), contentType: record.contentType }; }
  async writeLocal(key: string, bytes: Buffer) {
    if (!(this.provider instanceof LocalStorageProvider)) throw new NotFoundException();
    const record = await this.records.findOne({ key, status: 'pending', expiresAt: { $gt: new Date() } });
    if (!record || bytes.length !== record.size || sniffImageMime(bytes) !== record.contentType) throw new BadRequestException('Invalid upload content');
    await this.provider.write(key, bytes);
  }
  async deleteUserObjects(userId: string) {
    let deleted = 0;
    for await (const record of this.records.find({ userId: new Types.ObjectId(userId) })) { await this.provider.delete(record.key); await this.records.deleteOne({ _id: record._id }); deleted++; }
    return deleted;
  }
  async cleanup(now = new Date()) {
    if (this.running) return; this.running = true; let deleted = 0;
    try {
      for (let i = 0; i < 100; i++) {
        const record = await this.records.findOneAndUpdate({ expiresAt: { $lte: now }, $or: [{ status: { $ne: 'deleting' } }, { lockedUntil: { $lte: now } }] }, { $set: { status: 'deleting', lockedUntil: new Date(now.getTime() + 300_000) } }, { returnDocument: 'after' });
        if (!record) break;
        await this.provider.delete(record.key); await this.records.deleteOne({ _id: record._id, status: 'deleting' }); deleted++;
      }
      this.logger.log({ event: 'storage_cleanup', deleted }); return { deleted };
    } finally { this.running = false; }
  }
}
