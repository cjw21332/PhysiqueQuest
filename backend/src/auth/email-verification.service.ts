import { BadRequestException, HttpException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { createHash, randomBytes } from 'node:crypto';
import type { Connection } from 'mongoose';
import { configuredMailProvider } from '../providers/mail.provider.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
@Injectable()
export class EmailVerificationService implements OnModuleInit {
  private readonly logger = new Logger(EmailVerificationService.name);
  constructor(@InjectConnection() private readonly connection: Connection) {}
  private get db() { if (!this.connection.db) throw new Error('Database unavailable'); return this.connection.db; }
  async onModuleInit() {
    if (process.env.NODE_ENV !== 'production') await Promise.all([
      this.db.collection('email_verifications').createIndex({ tokenHash: 1 }, { unique: true }),
      this.db.collection('email_verifications').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      this.db.collection('email_verifications').createIndex({ userId: 1 }),
    ]);
  }
  async request(email: string) {
    const normalized = email.trim().toLowerCase(), now = new Date();
    const cooldown = hash(`verify-email:${normalized}`);
    try {
      await this.db.collection('auth_rate_limits').updateOne({ _id: cooldown as never, expiresAt: { $lte: now } }, { $set: { hits: 1, expiresAt: new Date(now.getTime() + 60_000) } }, { upsert: true });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) throw new HttpException('Wait 60 seconds before requesting another email.', 429);
      throw error;
    }
    const user = await this.db.collection('users').findOne({ email: normalized, isActive: true });
    const provider = configuredMailProvider();
    if (user && !user.emailVerified && provider) {
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(now.getTime() + Number(process.env.EMAIL_VERIFICATION_TTL_MINUTES || 60) * 60_000);
      await this.db.collection('email_verifications').insertOne({ userId: user._id, email: normalized, tokenHash: hash(token), usedAt: null, createdAt: now, expiresAt });
      const origin = process.env.EMAIL_VERIFICATION_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const url = new URL('/verify-email', origin); url.hash = new URLSearchParams({ token }).toString();
      if (!await provider.send({ template: 'verification', to: normalized, name: user.name, token, verificationUrl: url.toString() })) {
        await this.db.collection('email_verifications').deleteOne({ tokenHash: hash(token) });
        this.logger.warn({ event: 'verification_email_delivery_failed' });
      }
    }
    return { accepted: true };
  }
  async confirm(token: string) {
    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        const verification = await this.db.collection('email_verifications').findOneAndUpdate({ tokenHash: hash(token), usedAt: null, expiresAt: { $gt: new Date() } }, { $set: { usedAt: new Date() } }, { returnDocument: 'after', session });
        if (!verification) throw new BadRequestException('Verification link is invalid or expired.');
        const result = await this.db.collection('users').updateOne({ _id: verification.userId, email: verification.email, isActive: true }, { $set: { emailVerified: true, emailVerifiedAt: new Date(), legacyEmailAccess: false, updatedAt: new Date() } }, { session });
        if (result.matchedCount !== 1) throw new BadRequestException('Verification link is invalid or expired.');
        await this.db.collection('email_verifications').updateMany({ userId: verification.userId, usedAt: null }, { $set: { usedAt: new Date() } }, { session });
      });
    } finally { await session.endSession(); }
    return { verified: true };
  }
}
