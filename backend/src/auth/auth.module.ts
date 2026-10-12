import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { User, UserSchema } from './schemas/user.schema.js';
import { SignInEvent, SignInEventSchema } from './schemas/sign-in-event.schema.js';
import { JwtStrategy } from './jwt.strategy.js';
import type { SignOptions } from 'jsonwebtoken';
import { RecoveryToken, RecoveryTokenSchema } from './recovery-token.schema.js';
import { PasswordRecoveryService } from './password-recovery.service.js';
import { EmailDeliveryProvider } from '../providers/email-delivery.provider.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }, { name: RecoveryToken.name, schema: RecoveryTokenSchema }, { name: SignInEvent.name, schema: SignInEventSchema }]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (configService.get<string>('JWT_EXPIRES_IN') || '7d') as SignOptions['expiresIn'],
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, PasswordRecoveryService, EmailDeliveryProvider],
  exports: [AuthService, PasswordRecoveryService],
})
export class AuthModule {}
