import { Type } from 'class-transformer';
import { IsOptional, IsString, Matches, ValidateNested } from 'class-validator';

export class ActivityPreferencesDto {
  @IsOptional() @IsString() @Matches(/^[A-Za-z_+-]+(?:\/[A-Za-z0-9_+.-]+)*$/) timezone?: string;
}
export class UpdateActivityDto {
  @ValidateNested() @Type(() => ActivityPreferencesDto) state: ActivityPreferencesDto;
}
