import { Injectable, BadRequestException } from '@nestjs/common';
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
    if (!available) return { accepted: true, delivery: 'unavailable' as const };
    const user = await this.users.findOne({ email: emailAddress.trim().toLowerCase(), isActive: true });
    if (!user) return { accepted: true, delivery: 'queued' as const };
    const token = randomBytes(32).toString('base64url');
    const userId = new Types.ObjectId(String(user._id));
    await this.tokens.deleteMany({ userId, usedAt: null });
    await this.tokens.create({ userId, tokenHash: digest(token), expiresAt: new Date(Date.now() + 30 * 60_000), usedAt: null });
    const sent = await this.email.sendPasswordReset(user.email, token);
    if (!sent) {
      await this.tokens.deleteMany({ userId, tokenHash: digest(token) });
      return { accepted: true, delivery: 'unavailable' as const };
    }
    return { accepted: true, delivery: 'queued' as const };
  }

  async confirm(token: string, password: string) {
    const now = new Date();
    const recovery = await this.tokens.findOneAndUpdate(
      { tokenHash: digest(token), expiresAt: { $gt: now }, usedAt: null },
      { $set: { usedAt: now } },
      { new: true },
    );
    if (!recovery) throw new BadRequestException('Reset token is invalid or expired');
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await this.users.updateOne({ _id: recovery.userId, isActive: true }, { $set: { passwordHash } });
    if (result.matchedCount !== 1) throw new BadRequestException('Reset token is invalid or expired');
    await this.tokens.deleteMany({ userId: recovery.userId, _id: { $ne: recovery._id } });
    return { updated: true };
  }
}
