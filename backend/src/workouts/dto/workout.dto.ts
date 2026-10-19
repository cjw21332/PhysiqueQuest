import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsDefined,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsIn,
  IsTimeZone,
  Max,
  MaxLength,
  Min,
  MinLength,
  Matches,
  ValidateNested,
} from 'class-validator';

export class WorkoutExerciseDto {
  @IsString() @MinLength(1) @MaxLength(80) exerciseId: string;
  @IsString() @MinLength(1) @MaxLength(120) name: string;
  @IsString() @MaxLength(80) equipment: string;
  @IsOptional() @IsString() @MaxLength(80) prescription?: string;
  @IsInt() @Min(1) @Max(10) sets: number;
  @IsOptional() @IsString() @MaxLength(80) trackingPresetId?: string;
}

export class CreateWorkoutDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(80, { each: true })
  exerciseIds: string[];
  @IsDateString({ strict: true, strictSeparator: true }) startedAt: string;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(100) requestKey?: string;
  @IsOptional() @IsIn(['planned', 'standalone', 'recorded-set']) origin?:
    'planned' | 'standalone' | 'recorded-set';
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => WorkoutExerciseDto)
  exercises?: WorkoutExerciseDto[];
  @IsOptional() @IsString() @MaxLength(100) programVersion?: string;
  @IsOptional() @IsInt() @Min(0) @Max(6) dayIndex?: number;
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) scheduledDate?: string;
  @IsOptional() @IsTimeZone() timezone?: string;
}

export class PauseWorkoutDto {
  @IsBoolean() paused: boolean;
  @IsDateString({ strict: true, strictSeparator: true }) occurredAt: string;
  @IsOptional() @IsInt() @Min(0) expectedRevision?: number;
}

export class SetResultDto {
  @IsOptional() @IsInt() @Min(0) @Max(86400) durationSeconds?: number;
  @IsString() @MinLength(1) @MaxLength(100) setId: string;
  @IsString() @MinLength(1) @MaxLength(80) exerciseId: string;
  @IsInt() @Min(0) @Max(9) setIndex: number;
  @IsInt() @Min(0) @Max(1000) reps: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1000) loadKg?: number;
  @IsIn(['completed', 'skipped']) status: 'completed' | 'skipped';
  @IsIn(['manual', 'local-video']) source: 'manual' | 'local-video';
  @IsOptional() @IsInt() @Min(0) @Max(1000) detectedReps?: number;
  @IsOptional() @IsIn(['left', 'right']) side?: 'left' | 'right';
  @IsOptional() @IsString() @MaxLength(40) algorithmVersion?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(120) clipDurationSeconds?: number;
  @IsOptional() @IsString() @MaxLength(80) trackingPresetId?: string;
}
export class SaveSetDto {
  @IsInt() @Min(0) expectedRevision: number;
  @IsDefined() @ValidateNested() @Type(() => SetResultDto) result: SetResultDto;
}

export class ApplyRecordingDto {
  @IsString() @MinLength(1) @MaxLength(100) programVersion: string;
  @IsInt() @Min(0) @Max(6) dayIndex: number;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) scheduledDate: string;
  @IsTimeZone() timezone: string;
  @IsString() @MinLength(1) @MaxLength(80) exerciseId: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50)
  @ValidateNested({ each: true }) @Type(() => WorkoutExerciseDto)
  exercises: WorkoutExerciseDto[];
}

export class ExerciseResultDto {
  @IsString() @MinLength(1) @MaxLength(80) exerciseId: string;
  @IsInt() @Min(0) @Max(1000) reps: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1000) loadKg?: number;
}

export class CompleteWorkoutDto {
  @IsDateString({ strict: true, strictSeparator: true }) endedAt: string;
  @IsInt() @Min(0) @Max(86400) durationSeconds: number;
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ExerciseResultDto)
  exerciseResults: ExerciseResultDto[];
  @IsOptional() @IsInt() @Min(0) expectedRevision?: number;
}

export class RecordedWorkoutDto {
  @IsString() @MinLength(8) @MaxLength(100) requestKey: string;
  @IsDefined()
  @ValidateNested()
  @Type(() => WorkoutExerciseDto)
  exercise: WorkoutExerciseDto;
  @IsDefined() @ValidateNested() @Type(() => SetResultDto) result: SetResultDto;
  @IsDateString({ strict: true, strictSeparator: true }) performedAt: string;
  @IsTimeZone() timezone: string;
}
