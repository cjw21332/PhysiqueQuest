import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Matches,
  MinLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class MealDto {
  @IsOptional() @IsString() @MaxLength(80) id?: string;
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(1) @MaxLength(120) name: string;
  @IsIn(['Breakfast', 'Lunch', 'Snack', 'Dinner']) meal: string;
  @IsNumber() @Min(0) calories: number;
  @IsOptional() @IsString() @MaxLength(240) detail?: string;
  @IsOptional() @IsString() @MaxLength(20) time?: string;
  @IsOptional() @IsString() @MaxLength(30) source?: string;
  @IsOptional() @IsNumber() @Min(0) protein?: number;
  @IsOptional() @IsNumber() @Min(0) carbs?: number;
  @IsOptional() @IsNumber() @Min(0) fat?: number;
  @IsOptional() @IsInt() @Min(1) fdcId?: number;
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true, strictSeparator: true }) date?: string;
}

export class WaterDto {
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true, strictSeparator: true }) date: string;
  @IsInt() @Min(0) @Max(30) glasses: number;
}

export class DietaryPlanDto {
  @IsIn(['Clean Bulk', 'Weight Loss', 'Maintenance', 'Hypertrophy']) goal: string;
  @IsInt() @Min(1000) @Max(6000) calories: number;
  @IsInt() @Min(1) @Max(80) protein: number;
  @IsInt() @Min(1) @Max(80) carbs: number;
  @IsInt() @Min(1) @Max(80) fat: number;
  @IsOptional() @IsIn(['Sedentary', 'Light', 'Moderate', 'Active', 'Athlete']) activity?: string;
  @IsOptional() @IsDateString() startedAt?: string;
}

/** Per-100 g macros, exactly as the scan reports them. Informational only. */
export class ScannedMacrosDto {
  @IsNumber() @Min(0) kcal: number;
  @IsNumber() @Min(0) protein_g: number;
  @IsNumber() @Min(0) carbs_g: number;
  @IsNumber() @Min(0) fat_g: number;
}

/**
 * One detected item from a `POST /api/nutrition/scan` response.
 *
 * Field names are snake_case to match that response exactly, so a client can
 * post the `items` array straight back without remapping. The global
 * ValidationPipe runs `forbidNonWhitelisted`, so anything else is rejected.
 */
export class ScannedMealItemDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(1) @MaxLength(120) food_name: string;
  /** False when no USDA record matched; such items are skipped on write. */
  @IsBoolean() found: boolean;
  @IsOptional() @IsInt() @Min(1) fdc_id?: number;
  @IsOptional() @IsString() @MaxLength(240) description?: string;
  @IsNumber() @Min(0) kcal: number;
  @IsNumber() @Min(0) protein_g: number;
  @IsNumber() @Min(0) carbs_g: number;
  @IsNumber() @Min(0) fat_g: number;
  @IsOptional() @IsNumber() @Min(0) @Max(5000) est_weight_g?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1) confidence?: number;
  /**
   * Present on matched items. Accepted so the array round-trips unchanged, but
   * not persisted: the saved macros are already scaled to the estimated weight.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => ScannedMacrosDto)
  per_100g?: ScannedMacrosDto;
}

export class MealFromScanDto {
  /** One meal row is written per matched item. */
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ScannedMealItemDto)
  items: ScannedMealItemDto[];

  @IsIn(['Breakfast', 'Lunch', 'Snack', 'Dinner']) meal: string;
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true, strictSeparator: true }) date?: string;
  @IsOptional() @IsString() @MaxLength(20) time?: string;
}
