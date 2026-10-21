import { Injectable, BadRequestException, HttpException, HttpStatus, Logger, UnauthorizedException, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomBytes, randomInt } from 'node:crypto';
import { Model, Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from './schemas/user.schema.js';
import { RecoveryToken } from './recovery-token.schema.js';
import { AuthRateLimit } from './auth-rate-limit.schema.js';
import { EmailDeliveryProvider } from '../providers/email-delivery.provider.js';
import { RECOVERY_CODE_VALIDITY_MINUTES } from '../common/recovery-policy.js';
import { PrivacyService } from '../privacy/privacy.service.js';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const invalid = () => new BadRequestException('Recovery request is invalid or expired. Request a new code.');
type ChangeAccount = { userId: Types.ObjectId; accountEmail: string; sessionVersion: number };
@Injectable()
export class PasswordRecoveryService {
  private readonly logger = new Logger(PasswordRecoveryService.name);
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(RecoveryToken.name) private readonly tokens: Model<RecoveryToken>,
    private readonly email: EmailDeliveryProvider,
    @InjectModel(AuthRateLimit.name) private readonly limits: Model<AuthRateLimit>,
    private readonly config: ConfigService,
    @Optional() private readonly audit?: PrivacyService,
  ) {}

  private codeHash(requestId: string, code: string) {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET'))
      .update(`physiquequest:recovery:v2:${requestId}:${code}`).digest('hex');
  }
  private async limit(key: string, maximum: number, seconds: number) {
    const bucket = Math.floor(Date.now() / (seconds * 1000));
    const query = { _id: digest(`${key}:${bucket}`) };
    const update = { $inc: { hits: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 2) * seconds * 1000) } };
    const row = await this.limits.findOneAndUpdate(
      query, update,
      { upsert: true, returnDocument: 'after' },
    ).catch(async (error: { code?: number }) => {
      if (error.code !== 11000) throw error;
      return this.limits.findOneAndUpdate(query, update, { returnDocument: 'after' });
    });
    if (!row || row.hits > maximum) throw new HttpException('Too many recovery attempts. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
  }
  private async changeAccount(userId: string): Promise<ChangeAccount> {
    if (!Types.ObjectId.isValid(userId)) throw new UnauthorizedException();
    const user = await this.users.findOne({ _id: new Types.ObjectId(userId), isActive: true });
    if (!user) throw new UnauthorizedException();
    return { userId: user._id, accountEmail: user.email, sessionVersion: user.sessionVersion ?? 0 };
  }
  private scope(account?: ChangeAccount) {
    // Missing purpose is accepted only for legacy signed-out recovery requests.
    return account ? { purpose: 'password-change', ...account } : { purpose: { $ne: 'password-change' } };
  }
  private versionFilter(account: ChangeAccount) {
    return account.sessionVersion === 0 ? { $in: [0, null] } : account.sessionVersion;
  }
  async requestChange(userId: string, ip = 'unknown') {
    const account = await this.changeAccount(userId);
    return { ...await this.request(account.accountEmail, ip, account), email: account.accountEmail };
  }
  async verifyChange(userId: string, requestId: string, code: string, ip = 'unknown') {
    return this.verify(requestId, code, ip, await this.changeAccount(userId));
  }
  async confirmChange(userId: string, resetToken: string, password: string, ip = 'unknown') {
    return this.confirm(resetToken, password, ip, await this.changeAccount(userId));
  }
  async request(emailAddress: string, ip = 'unknown', account?: ChangeAccount) {
    const email = emailAddress.trim().toLowerCase();
    await this.limit(`request:ip:${ip}`, 20, 3600);
    try {
      await this.limits.findOneAndUpdate(
        { _id: digest(`cooldown:${email}`), expiresAt: { $lte: new Date() } },
        { $set: { hits: 1, expiresAt: new Date(Date.now() + 60_000) } },
        { upsert: true, returnDocument: 'after' },
      );
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      throw new HttpException('Please wait 60 seconds before requesting another code.', HttpStatus.TOO_MANY_REQUESTS);
    }
    await this.limit(`request:hour:${email}`, 5, 3600);
    const requestId = randomBytes(32).toString('hex');
    const available = this.email.isAvailable();
    const response = { accepted: true, requestId, delivery: available ? 'queued' as const : 'unavailable' as const };
    if (!available && (process.env.NODE_ENV !== 'development' || account)) return response;
    const user = await this.users.findOne({ email, isActive: true, ...(account ? { _id: account.userId, sessionVersion: this.versionFilter(account) } : {}) });
    if (!user) return response;
    const code = String(randomInt(100000, 1_000_000));
    // Each request has an independent digest, so equal six-digit codes never collide.
    await this.tokens.updateMany({ userId: user._id, usedAt: null }, { $set: { usedAt: new Date() } });
    await this.tokens.create({ userId: user._id, purpose: account ? 'password-change' : 'password-reset', ...account, requestId, tokenHash: this.codeHash(requestId, code), attempts: 0,
      verifiedAt: null, expiresAt: new Date(Date.now() + RECOVERY_CODE_VALIDITY_MINUTES * 60_000), usedAt: null });
    if (!available) return { ...response, code };
    const sent = await this.email.sendPasswordReset(user.email, code, user.name);
    if (!sent.ok) {
      await this.tokens.updateMany({ requestId }, { $set: { usedAt: new Date() } });
      this.logger.warn(`Recovery email was not delivered (${sent.code}).`);
      // Keep the production response account-neutral, including delivery failures.
      if (process.env.NODE_ENV === 'development') return { ...response, delivery: 'unavailable' as const, reason: 'Email delivery failed. Check the backend provider configuration.' };
    }
    return response;
  }
  diagnostics() { return { provider: this.email.diagnostics() }; }

  async verify(requestId: string, code: string, ip = 'unknown', account?: ChangeAccount) {
    await this.limit(`verify:ip:${ip}`, 60, 900);
    // Count every attempt before checking the digest, atomically across instances.
    const attempted = await this.tokens.findOneAndUpdate(
      { ...this.scope(account), requestId, usedAt: null, verifiedAt: null, attempts: { $lt: 5 }, expiresAt: { $gt: new Date() } },
      { $inc: { attempts: 1 } }, { returnDocument: 'after' },
    );
    if (!attempted) throw invalid();
    const resetToken = randomBytes(32).toString('hex');
    const verified = await this.tokens.findOneAndUpdate(
      { ...this.scope(account), _id: attempted._id, requestId, tokenHash: this.codeHash(requestId, code), usedAt: null, verifiedAt: null, expiresAt: { $gt: new Date() } },
      { $set: { verifiedAt: new Date(), grantHash: digest(resetToken), grantExpiresAt: new Date(Date.now() + 5 * 60_000) } },
      { returnDocument: 'after' },
    );
    if (!verified) throw invalid();
    return { verified: true, resetToken };
  }
  async confirm(resetToken: string, password: string, ip = 'unknown', account?: ChangeAccount) {
    await this.limit(`confirm:ip:${ip}`, 30, 900);
    // Hash before opening a database transaction to minimize transaction time.
    const passwordHash = await bcrypt.hash(password, 10);
    const session = await this.tokens.db.startSession();
    let actorId: string | undefined;
    try {
      await session.withTransaction(async () => {
        const recovery = await this.tokens.findOneAndUpdate(
          { ...this.scope(account), grantHash: digest(resetToken), usedAt: null, verifiedAt: { $ne: null }, grantExpiresAt: { $gt: new Date() }, expiresAt: { $gt: new Date() } },
          { $set: { usedAt: new Date() } }, { returnDocument: 'after', session },
        );
        if (!recovery) throw invalid();
        const result = await this.users.updateOne({ _id: recovery.userId, isActive: true,
          ...(account ? { email: account.accountEmail, sessionVersion: this.versionFilter(account) } : {}) },
          { $set: { passwordHash, failedLoginAttempts: 0, lockoutUntil: null, emailVerified: true, emailVerifiedAt: new Date(), legacyEmailAccess: false }, $inc: { sessionVersion: 1 } }, { session });
        if (result.matchedCount !== 1) throw invalid();
        actorId = String(recovery.userId);
        await this.tokens.updateMany({ userId: recovery.userId, usedAt: null }, { $set: { usedAt: new Date() } }, { session });
      });
    } finally { await session.endSession(); }
    if (actorId && this.audit) await this.audit.audit({ actorId, action: account ? 'password_changed' : 'password_reset_completed', ip }).catch(() => this.logger.warn({ event: 'audit_persistence_failed' }));
    return { updated: true };
  }
}
