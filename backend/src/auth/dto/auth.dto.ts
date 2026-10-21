import { Transform } from 'class-transformer';
import { IsEmail, IsEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { IsStrongPassword } from '../validators/password.validator.js';
import { ApiHideProperty } from '@nestjs/swagger';

export class RegisterDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsString()
  @IsStrongPassword({
    message: 'Password must contain at least one lowercase letter, one uppercase letter, one number, and be between 8-15 characters'
  })
  password: string;
}

export class LoginDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}

export class AuthResponseDto {
  access_token: string;
  user: {
    id: string;
    email: string;
    name: string;
    emailVerified?: boolean;
    legacyEmailAccess?: boolean;
  };
}

export class SessionResponseDto extends AuthResponseDto {
  expires_in: number;
}

export class RefreshDto {
  @ApiHideProperty()
  @IsEmpty({ message: 'Refresh credentials must be supplied by cookie' })
  refresh_token?: never;
}
