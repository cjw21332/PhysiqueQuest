import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class MealDto {
  @IsOptional() @IsString() @MaxLength(80) id?: string;
  @IsString() @MaxLength(120) name: string;
  @IsIn(['Breakfast', 'Lunch', 'Snack', 'Dinner']) meal: string;
  @IsNumber() @Min(0) calories: number;
  @IsOptional() @IsString() @MaxLength(240) detail?: string;
  @IsOptional() @IsString() @MaxLength(20) time?: string;
  @IsOptional() @IsString() @MaxLength(30) source?: string;
  @IsOptional() @IsNumber() @Min(0) protein?: number;
  @IsOptional() @IsNumber() @Min(0) carbs?: number;
  @IsOptional() @IsNumber() @Min(0) fat?: number;
  @IsOptional() @IsString() @MaxLength(10) date?: string;
}

export class WaterDto {
  @IsString() @MaxLength(10) date: string;
  @IsInt() @Min(0) @Max(30) glasses: number;
}
