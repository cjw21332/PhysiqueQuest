import { IsEmail, IsString, Length, MaxLength, Matches } from 'class-validator';
export class ResendVerificationDto { @IsEmail() @MaxLength(254) email: string; }
export class ConfirmVerificationDto { @IsString() @Length(64, 64) @Matches(/^[a-f0-9]{64}$/) token: string; }
