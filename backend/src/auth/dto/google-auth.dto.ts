import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { IsStrongPassword } from '../validators/password.validator.js';

export class GoogleTokenDto {
  @IsString() @MinLength(1) @MaxLength(10000) idToken: string;
}
export class GoogleCheckDto extends GoogleTokenDto {
  @IsIn(['login', 'register']) intent: 'login' | 'register';
}
export class GoogleLoginDto extends GoogleTokenDto {
  @IsOptional() @Matches(/^[a-f0-9]{64}$/) requestId?: string;
  @IsOptional() @Matches(/^\d{6}$/) code?: string;
}
export class GoogleRegisterDto extends GoogleTokenDto {
  @IsString() @IsStrongPassword() password: string;
  @Matches(/^[a-f0-9]{64}$/) requestId: string;
  @Matches(/^\d{6}$/) code: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) name?: string;
}
