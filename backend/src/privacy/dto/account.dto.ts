import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class DeleteAccountDto {
  @IsString() @MinLength(1) @MaxLength(72) password: string;
}
export class RecoverAccountDto extends DeleteAccountDto {
  @IsEmail() @MaxLength(254) email: string;
}
