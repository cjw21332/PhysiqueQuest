import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, ValidateNested } from 'class-validator';

export class SettingsValuesDto {
  @IsOptional() @IsBoolean() inactivity?: boolean;
  @IsOptional() @IsBoolean() alarmVolume?: boolean;
  @IsOptional() @IsBoolean() showLeaderboard?: boolean;
  @IsOptional() @IsIn([30, 45, 60]) threshold?: number;
  // Kept for compatibility with saved installations predating per-alert settings.
  @IsOptional() @IsBoolean() notifications?: boolean;
}

export class UpdateSettingsDto {
  @ValidateNested()
  @Type(() => SettingsValuesDto)
  values: SettingsValuesDto;
}
