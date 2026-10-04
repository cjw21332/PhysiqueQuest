import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

export class CreateWorkoutDto {
  @IsArray() @ArrayUnique() @ArrayMaxSize(50) @IsString({ each: true }) @MinLength(1, { each: true }) @MaxLength(80, { each: true }) exerciseIds: string[];
  @IsDateString({ strict: true, strictSeparator: true }) startedAt: string;
}

export class PauseWorkoutDto {
  @IsBoolean() paused: boolean;
  @IsDateString({ strict: true, strictSeparator: true }) occurredAt: string;
}

export class ExerciseResultDto {
  @IsString() @MinLength(1) @MaxLength(80) exerciseId: string;
  @IsInt() @Min(0) @Max(1000) reps: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1000) loadKg?: number;
}

export class CompleteWorkoutDto {
  @IsDateString({ strict: true, strictSeparator: true }) endedAt: string;
  @IsInt() @Min(0) @Max(86400) durationSeconds: number;
  @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => ExerciseResultDto) exerciseResults: ExerciseResultDto[];
}
