import { AccountLifecycleFence } from '../privacy/account-lifecycle-fence.js';
import { ConflictException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { GoogleIdentityService, type GoogleIdentity } from './google-identity.service.js';
import { EmailVerificationService } from './email-verification.service.js';
import { User } from './schemas/user.schema.js';
import { SignInEvent } from './schemas/sign-in-event.schema.js';
import type { GoogleLoginDto, GoogleRegisterDto } from './dto/google-auth.dto.js';
import { Profile } from '../profile/schemas/profile.schema.js';
import { validateProfileMeasurements } from '../profile/profile.service.js';

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);

  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(SignInEvent.name) private readonly signIns: Model<SignInEvent>,
    private readonly identities: GoogleIdentityService,
    private readonly verification: EmailVerificationService,
    @InjectModel(Profile.name) private readonly profiles: Model<Profile>,
  ) {}

  private async find(identity: GoogleIdentity) {
    // The provider identity stays bound even if an account email changes.
    return await this.users.findOne({ googleUid: identity.uid }) ?? await this.users.findOne({ email: identity.email });
  }
  private active(user: User) {
    if (!user.isActive || user.deletedAt) throw new UnauthorizedException('Account is disabled.');
  }
  private record(userId: Types.ObjectId, source: 'login' | 'register', generation?: number) {
    return new AccountLifecycleFence(this.users.db).withActiveWrite(String(userId), async session => this.signIns.create([{ userId, source, occurredAt: new Date() }], { session }), generation)
      .catch(() => this.logger.warn('Failed to record Google sign-in event for admin analytics'));
  }
  async check(idToken: string, intent: 'login' | 'register') {
    const identity = await this.identities.verify(idToken);
    const existing = await this.find(identity);
    if (existing) this.active(existing);
    if (existing && intent === 'register') {
      const profile = await this.profiles.exists({ userId: existing._id });
      if (!profile) return { email: identity.email, name: identity.name, registered: true, needsProfile: true };
      throw new ConflictException({ code: 'GOOGLE_LOGIN_REQUIRED', message: 'This email already has an account. Go to Log in and choose Log in with Google.' });
    }
    if (!existing && intent === 'login') throw new NotFoundException({ code: 'GOOGLE_REGISTRATION_REQUIRED', message: 'This Google account is not registered. Go to Register and choose Register with Google.' });
    return { email: identity.email, name: identity.name, registered: Boolean(existing) };
  }
  async login(dto: GoogleLoginDto) {
    const identity = await this.identities.verify(dto.idToken);
    let user = await this.find(identity);
    if (!user) throw new NotFoundException({ code: 'GOOGLE_REGISTRATION_REQUIRED', message: 'This Google account is not registered. Go to Register and choose Register with Google.' });
    this.active(user);
    const generation = await new AccountLifecycleFence(this.users.db).generation(String(user._id));
    if (user.googleUid && user.googleUid !== identity.uid) throw new UnauthorizedException('This account is connected to a different Google identity.');
    if (!user.googleUid) {
      const owner = user._id;
      await this.users.init();
      user = await new AccountLifecycleFence(this.users.db).withActiveWrite(String(owner), async session => this.users.findOneAndUpdate(
        { _id: owner, email: identity.email, isActive: true, googleUid: { $exists: false } },
        { $set: { googleUid: identity.uid, emailVerified: true, emailVerifiedAt: new Date(), legacyEmailAccess: false } },
        { returnDocument: 'after', session },
      ), generation);
      if (!user) throw new ConflictException('Account changed. Choose your Google account again.');
    }
    await this.record(user._id, 'login', generation);
    return user;
  }
  async register(dto: GoogleRegisterDto) {
    validateProfileMeasurements(dto.profile);
    const identity = await this.identities.verify(dto.idToken);
    await this.users.init();
    if (await this.find(identity)) throw new ConflictException({ code: 'GOOGLE_LOGIN_REQUIRED', message: 'This email already has an account. Go to Log in and choose Log in with Google.' });
    await this.verification.consumeRegistration(identity.email, dto.requestId, dto.code);
    const passwordHash = await bcrypt.hash(dto.password, 10);
    try {
      const session = await this.users.db.startSession();
      let user!: import('mongoose').HydratedDocument<User>;
      try { await session.withTransaction(async () => {
        [user] = await this.users.create([{ email: identity.email, name: (dto.name?.trim() || identity.name || identity.email.split('@')[0]).slice(0, 100), passwordHash, googleUid: identity.uid, emailVerified: true, emailVerifiedAt: new Date(), legacyEmailAccess: false, authPolicyVersion: 2 }], { session });
        await this.profiles.create([{ ...dto.profile, userId: user._id }], { session });
        await this.users.db.collection('account_lifecycle').insertOne({ _id: user._id, status: 'active', writeVersion: 0 }, { session });
      }, { writeConcern: { w: 'majority' } }); } finally { await session.endSession(); }
      await this.record(user._id, 'register');
      return user;
    } catch (error) {
      if (isDuplicateKeyError(error)) throw new ConflictException({ code: 'GOOGLE_LOGIN_REQUIRED', message: 'This account is already registered. Go to Log in and choose Log in with Google.' });
      throw error;
    }
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}
