import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { Model, Types } from 'mongoose';
import { AuthSession } from './session.schema.js';
import { User } from './schemas/user.schema.js';
import { afterDays, retention } from '../privacy/retention.js';
import { emailStatus } from './email-verification.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const invalid = () => new UnauthorizedException('Session expired. Sign in again.');

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  constructor(
    @InjectModel(AuthSession.name) private readonly sessions: Model<AuthSession>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly jwt: JwtService,
  ) {}

  private response(user: User & { _id: unknown }, sessionId: string, refreshToken: string) {
    return {
      access_token: this.jwt.sign({ sub: String(user._id), sessionVersion: user.sessionVersion ?? 0, sid: sessionId, tokenVersion: 2 }, { expiresIn: '15m' }),
      refresh_token: refreshToken,
      expires_in: 900,
      user: { id: String(user._id), email: user.email, name: user.name, ...emailStatus(user) },
    };
  }

  async issue(user: User & { _id: unknown }) {
    const id = randomBytes(32).toString('hex');
    const token = `${id}.${randomBytes(32).toString('hex')}`;
    const expiresAt = afterDays(new Date(), 30);
    await this.sessions.create({ _id: id, userId: new Types.ObjectId(String(user._id)), sessionVersion: user.sessionVersion ?? 0,
      tokenHash: hash(token), expiresAt, purgeAt: afterDays(expiresAt, retention('REFRESH_TOKEN_RECORD_BUFFER_DAYS')), lastUsedAt: new Date() });
    return this.response(user, id, token);
  }

  async validate(id: string, userId: string, version: number) {
    if (!/^[a-f0-9]{64}$/.test(id)) throw invalid();
    const session = await this.sessions.findById(id);
    if (!session || String(session.userId) !== userId || session.sessionVersion !== version || session.revokedAt || session.expiresAt <= new Date()) throw invalid();
    return session;
  }

  async refresh(token: string) {
    if (!/^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(token)) throw invalid();
    const id = token.slice(0, 64);
    const session = await this.sessions.findById(id);
    if (!session || session.revokedAt || session.expiresAt <= new Date()) throw invalid();
    if (session.usedHashes.length >= 10_000) { await this.revoke(id, String(session.userId)); throw invalid(); }
    const user = await this.users.findById(session.userId);
    if (!user || !user.isActive || (user.sessionVersion ?? 0) !== session.sessionVersion) throw invalid();
    const digest = hash(token);
    const next = `${id}.${randomBytes(32).toString('hex')}`;
    const rotated = await this.sessions.findOneAndUpdate(
      { _id: id, tokenHash: digest, revokedAt: null, expiresAt: { $gt: new Date() } },
      { $set: { tokenHash: hash(next), lastUsedAt: new Date() }, $push: { usedHashes: digest } },
      { returnDocument: 'before' },
    );
    if (!rotated) {
      const latest = await this.sessions.findById(id);
      if (latest?.usedHashes.includes(digest)) {
        await this.revoke(id, String(session.userId));
        this.logger.warn({ event: 'refresh_token_reuse' });
      }
      throw invalid();
    }
    return this.response(user, id, next);
  }

  async revoke(id: string, userId: string) {
    await this.sessions.updateOne({ _id: id, userId: new Types.ObjectId(userId) }, { $set: { revokedAt: new Date() } });
  }

  async list(userId: string, version: number) {
    return this.sessions.find({ userId: new Types.ObjectId(userId), sessionVersion: version, revokedAt: null, expiresAt: { $gt: new Date() } })
      .select('_id createdAt lastUsedAt expiresAt').sort({ lastUsedAt: -1 }).limit(100).lean().exec();
  }
}
