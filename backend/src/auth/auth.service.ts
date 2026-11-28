import { AccountLifecycleFence } from '../privacy/account-lifecycle-fence.js';
import { Injectable, Logger, UnauthorizedException, ConflictException, HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, type HydratedDocument } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { User } from './schemas/user.schema.js';
import { SignInEvent } from './schemas/sign-in-event.schema.js';
import { RegisterDto, LoginDto, AuthResponseDto } from './dto/auth.dto.js';
import { emailStatus } from './email-verification.js';
import { Profile } from '../profile/schemas/profile.schema.js';
import { validateProfileMeasurements } from '../profile/profile.service.js';
import { IsStrongPasswordConstraint } from './validators/password.validator.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(SignInEvent.name) private signInEvents: Model<SignInEvent>,
    private jwtService: JwtService,
    @InjectModel(Profile.name) private profiles: Model<Profile>,
  ) {}

  /**
   * Records one row per successful authentication for admin analytics
   * (activeUsers, weeklyRetention). Best-effort: a logging failure must never
   * block an otherwise successful sign-in.
   */
  private async recordSignIn(userId: string, source: 'login' | 'register', generation?: number): Promise<void> {
    await new AccountLifecycleFence(this.signInEvents.db).withActiveWrite(userId, async lifecycleSession => (await this.signInEvents.create([{ userId: new Types.ObjectId(userId), occurredAt: new Date(), source }], { session: lifecycleSession }))[0], generation)
      .catch(() => this.logger.warn('Failed to record sign-in event for admin analytics'));
  }

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    validateProfileMeasurements(registerDto.profile);
    const { email, name, password } = registerDto;
    // Ensure the unique email index exists before accepting any registration.
    await this.userModel.init();

    // Check if user already exists
    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await this.userModel.findOne({ email: normalizedEmail });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // The unique email index is the final guard against concurrent duplicate registrations.
    const session = await this.userModel.db.startSession();
    let user!: HydratedDocument<User>;
    try { await session.withTransaction(async () => {
      [user] = await this.userModel.create([{ email: normalizedEmail, name: name.trim(), passwordHash, emailVerified: true, emailVerifiedAt: new Date(), legacyEmailAccess: false, authPolicyVersion: 2 }], { session });
      await this.profiles.create([{ ...registerDto.profile, userId: user._id }], { session });
      await this.userModel.db.collection('account_lifecycle').insertOne({ _id: user._id, status: 'active', writeVersion: 0 }, { session });
    }, { writeConcern: { w: 'majority' } }); } catch (error: unknown) {
      if (isDuplicateKeyError(error)) throw new ConflictException('Email already registered');
      throw error;
    } finally { await session.endSession(); }

    // Generate JWT token
    const payload = { sub: user._id.toString(), email: user.email, sessionVersion: user.sessionVersion ?? 0 };
    const access_token = this.jwtService.sign(payload);
    await this.recordSignIn(user._id.toString(), 'register');

    return {
      access_token,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        ...emailStatus(user),
      },
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    // Find user
    const user = await this.userModel.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash');
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    const generation = await new AccountLifecycleFence(this.userModel.db).generation(String(user._id));
    const now = new Date();
    if (user.lockoutUntil && user.lockoutUntil > now) {
      throw new HttpException('Sign-in is paused for 15 minutes after too many failed attempts.', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (user.lockoutUntil && user.lockoutUntil <= now) {
      await new AccountLifecycleFence(this.userModel.db).withActiveWrite(String(user._id), async lifecycleSession => this.userModel.updateOne({ _id: user._id }, { $set: { failedLoginAttempts: 0, lockoutUntil: null } }).session(lifecycleSession), generation);
      user.failedLoginAttempts = 0;
      user.lockoutUntil = null;
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      const failedUser = await new AccountLifecycleFence(this.userModel.db).withActiveWrite(String(user._id), async lifecycleSession => this.userModel.findByIdAndUpdate(
        user._id,
        { $inc: { failedLoginAttempts: 1 } },
        { returnDocument: 'after' },
      ).session(lifecycleSession), generation);
      if (failedUser && failedUser.failedLoginAttempts >= 5) {
        const lockoutUntil = new Date(Date.now() + 15 * 60_000);
        await new AccountLifecycleFence(this.userModel.db).withActiveWrite(String(user._id), async lifecycleSession => this.userModel.updateOne({ _id: user._id }, { $set: { lockoutUntil } }).session(lifecycleSession), generation);
        throw new HttpException('Sign-in is paused for 15 minutes after too many failed attempts.', HttpStatus.TOO_MANY_REQUESTS);
      }
      throw new UnauthorizedException('Invalid email or password');
    }

    await new AccountLifecycleFence(this.userModel.db).withActiveWrite(String(user._id), async lifecycleSession => this.userModel.updateOne({ _id: user._id }, { $set: { failedLoginAttempts: 0, lockoutUntil: null } }).session(lifecycleSession), generation);

    // Generate JWT token
    const payload = { sub: user._id.toString(), email: user.email, sessionVersion: user.sessionVersion ?? 0 };
    const access_token = this.jwtService.sign(payload);
    await this.recordSignIn(user._id.toString(), 'login', generation);

    return {
      access_token,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        ...emailStatus(user),
      },
    };
  }

  async validateUser(userId: string): Promise<HydratedDocument<User>> {
    const generation = await new AccountLifecycleFence(this.userModel.db).generation(userId);
    const user = await this.userModel.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid user');
    }
    user.$locals.lifecycleGeneration = generation;
    return user;
  }

  async changeInitialAdminPassword(userId: string, currentPassword: unknown, newPassword: unknown) {
    if (typeof currentPassword !== 'string' || currentPassword.length > 128 || typeof newPassword !== 'string' || !new IsStrongPasswordConstraint().validate(newPassword) || currentPassword === newPassword) throw new BadRequestException('Choose a different password with 8-15 characters, an uppercase letter, a lowercase letter and a number.');
    const user = await this.userModel.findById(userId).select('+passwordHash');
    if (!user || user.role !== 'admin' || !user.mustChangePassword || !await bcrypt.compare(currentPassword, user.passwordHash)) throw new UnauthorizedException('Unable to change password.');
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const result = await new AccountLifecycleFence(this.userModel.db).withActiveWrite(userId, async session => this.userModel.updateOne({ _id: user._id, mustChangePassword: true, passwordHash: user.passwordHash }, { $set: { passwordHash, mustChangePassword: false }, $inc: { sessionVersion: 1 } }).session(session));
    if (!result.modifiedCount) throw new ConflictException('The password has already changed. Sign in again.');
    return { updated: true };
  }

  async revokeAll(userId: string): Promise<void> {
    await new AccountLifecycleFence(this.userModel.db).withActiveWrite(userId, async lifecycleSession => this.userModel.updateOne({ _id: new Types.ObjectId(userId) }, { $inc: { sessionVersion: 1 } }).session(lifecycleSession));
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}
