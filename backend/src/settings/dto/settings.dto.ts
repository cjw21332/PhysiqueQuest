import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, Min, Max, IsOptional, ValidateNested } from 'class-validator';

export class NutritionTargetsDto {
  @IsInt() @Min(1) @Max(10000) calories: number;
  @IsInt() @Min(0) @Max(1000) protein: number;
  @IsInt() @Min(0) @Max(2000) carbs: number;
  @IsInt() @Min(0) @Max(1000) fats: number;
}

export class SettingsValuesDto {
  @IsOptional() @ValidateNested() @Type(() => NutritionTargetsDto) nutritionTargets?: NutritionTargetsDto;
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
