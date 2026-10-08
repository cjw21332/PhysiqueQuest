import { Injectable, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomBytes } from 'node:crypto';
import { Model, Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from './schemas/user.schema.js';
import { RecoveryToken } from './recovery-token.schema.js';
import { EmailDeliveryProvider } from '../providers/email-delivery.provider.js';

const digest = (token: string) => createHash('sha256').update(token).digest('hex');
@Injectable()
export class PasswordRecoveryService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(RecoveryToken.name) private readonly tokens: Model<RecoveryToken>,
    private readonly email: EmailDeliveryProvider,
  ) {}

  async request(emailAddress: string) {
    const available = this.email.isAvailable();
    if (!available && process.env.NODE_ENV !== 'development') {
      return { accepted: true, delivery: 'unavailable' as const };
    }
    const user = await this.users.findOne({ email: emailAddress.trim().toLowerCase(), isActive: true });
    // Keep the response neutral about whether an email is registered.
    if (!user) return { accepted: true, delivery: available ? 'queued' as const : 'unavailable' as const };
    const now = new Date();
    const recentRequest = await this.tokens.findOne({ userId: user._id, expiresAt: { $gt: now } }).sort({ createdAt: -1 });
    if (recentRequest && now.getTime() - recentRequest.createdAt.getTime() < 60_000) {
      throw new HttpException('Please wait 60 seconds before requesting another code.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const userId = new Types.ObjectId(String(user._id));
    await this.tokens.deleteMany({ userId, usedAt: null });
    await this.tokens.create({ userId, tokenHash: digest(code), expiresAt: new Date(Date.now() + 30 * 60_000), usedAt: null });
    if (available) {
      const sent = await this.email.sendPasswordReset(user.email, code);
      if (!sent) {
        await this.tokens.deleteMany({ userId, tokenHash: digest(code) });
        return { accepted: true, delivery: 'unavailable' as const };
      }
      return { accepted: true, delivery: 'queued' as const };
    }
    // Keep the no-email recovery path local to development only.
    return { accepted: true, delivery: 'unavailable' as const, code };
  }

  async verify(token: string) {
    const recovery = await this.tokens.findOne({
      tokenHash: digest(token),
      expiresAt: { $gt: new Date() },
      usedAt: null,
    });
    if (!recovery) throw new BadRequestException('Verification code is invalid or expired');
    return { verified: true };
  }

  async confirm(token: string, password: string) {
    const now = new Date();
    const recovery = await this.tokens.findOneAndUpdate(
      { tokenHash: digest(token), expiresAt: { $gt: now }, usedAt: null },
      { $set: { usedAt: now } },
      { returnDocument: 'after' },
    );
    if (!recovery) throw new BadRequestException('Reset token is invalid or expired');
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await this.users.updateOne({ _id: recovery.userId, isActive: true }, { $set: { passwordHash } });
    if (result.matchedCount !== 1) throw new BadRequestException('Reset token is invalid or expired');
    await this.tokens.deleteMany({ userId: recovery.userId, _id: { $ne: recovery._id } });
    return { updated: true };
  }
}
