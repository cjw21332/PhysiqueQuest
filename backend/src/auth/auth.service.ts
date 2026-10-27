import { Injectable, Logger, UnauthorizedException, ConflictException, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, type HydratedDocument } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { User } from './schemas/user.schema.js';
import { SignInEvent } from './schemas/sign-in-event.schema.js';
import { RegisterDto, LoginDto, AuthResponseDto } from './dto/auth.dto.js';
import { emailStatus } from './email-verification.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(SignInEvent.name) private signInEvents: Model<SignInEvent>,
    private jwtService: JwtService,
  ) {}

  /**
   * Records one row per successful authentication for admin analytics
   * (activeUsers, weeklyRetention). Best-effort: a logging failure must never
   * block an otherwise successful sign-in.
   */
  private recordSignIn(userId: string, source: 'login' | 'register'): void {
    void this.signInEvents.create({ userId: new Types.ObjectId(userId), occurredAt: new Date(), source })
      .catch(() => this.logger.warn('Failed to record sign-in event for admin analytics'));
  }

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
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
    const user = await this.userModel.create({ email: normalizedEmail, name: name.trim(), passwordHash, emailVerified: true, emailVerifiedAt: new Date(), legacyEmailAccess: false, authPolicyVersion: 2 }).catch((error: unknown) => {
      if (isDuplicateKeyError(error)) throw new ConflictException('Email already registered');
      throw error;
    });

    // Generate JWT token
    const payload = { sub: user._id.toString(), email: user.email, sessionVersion: user.sessionVersion ?? 0 };
    const access_token = this.jwtService.sign(payload);
    this.recordSignIn(user._id.toString(), 'register');

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

    const now = new Date();
    if (user.lockoutUntil && user.lockoutUntil > now) {
      throw new HttpException('Sign-in is paused for 15 minutes after too many failed attempts.', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (user.lockoutUntil && user.lockoutUntil <= now) {
      await this.userModel.updateOne({ _id: user._id }, { $set: { failedLoginAttempts: 0, lockoutUntil: null } });
      user.failedLoginAttempts = 0;
      user.lockoutUntil = null;
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      const failedUser = await this.userModel.findByIdAndUpdate(
        user._id,
        { $inc: { failedLoginAttempts: 1 } },
        { returnDocument: 'after' },
      );
      if (failedUser && failedUser.failedLoginAttempts >= 5) {
        const lockoutUntil = new Date(Date.now() + 15 * 60_000);
        await this.userModel.updateOne({ _id: user._id }, { $set: { lockoutUntil } });
        throw new HttpException('Sign-in is paused for 15 minutes after too many failed attempts.', HttpStatus.TOO_MANY_REQUESTS);
      }
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.userModel.updateOne({ _id: user._id }, { $set: { failedLoginAttempts: 0, lockoutUntil: null } });

    // Generate JWT token
    const payload = { sub: user._id.toString(), email: user.email, sessionVersion: user.sessionVersion ?? 0 };
    const access_token = this.jwtService.sign(payload);
    this.recordSignIn(user._id.toString(), 'login');

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
    const user = await this.userModel.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid user');
    }
    return user;
  }

  async revokeAll(userId: string): Promise<void> {
    await this.userModel.updateOne({ _id: new Types.ObjectId(userId) }, { $inc: { sessionVersion: 1 } });
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}
