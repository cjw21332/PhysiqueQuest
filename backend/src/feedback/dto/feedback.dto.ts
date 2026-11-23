import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateFeedbackDto {
  @IsIn(['pose', 'manual']) source: 'pose' | 'manual';
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(1) @MaxLength(100) exercise: string;
  @IsOptional() @IsString() @MaxLength(100) sessionRef?: string;
  @IsInt() @Min(1) @Max(10) rpe: number;
  @IsIn(['too_easy', 'just_right', 'too_hard']) difficulty: 'too_easy' | 'just_right' | 'too_hard';
  @IsOptional() @IsInt() @Min(1) @Max(5) enjoyment?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(40, { each: true }) painLocations?: string[];
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}
