import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, Matches } from 'class-validator';
import { IsStrongPassword } from '../validators/password.validator.js';

export class PasswordResetRequestDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail() @MaxLength(254) email: string;
}
export class PasswordResetVerifyDto {
  @IsString() @Matches(/^\d{6}$/, { message: 'Reset code must be exactly 6 digits' }) code: string;
}
export class PasswordResetConfirmDto {
  @IsString() @Matches(/^\d{6}$/, { message: 'Reset code must be exactly 6 digits' }) code: string;
  @IsString() @IsStrongPassword({ message: 'Password must contain an uppercase letter, a lowercase letter, and a number; use 8–15 characters' }) password: string;
}
