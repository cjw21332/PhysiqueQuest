import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CONSENT_VERSION } from '../dataset-consent.js';
import { MAX_FRAMES } from '../dataset-payload.js';
import { PATTERNS } from '../schemas/dataset-clip.schema.js';

export class AcceptDatasetConsentDto {
  @IsIn([CONSENT_VERSION]) version: string;
  @IsBoolean() accepted: boolean;
  /** Lets the server prove the client showed the same text it records. */
  @IsString() @MaxLength(64) textHash: string;
}

export class RepBoundaryDto {
  @IsInt() @Min(0) startFrame: number;
  @IsInt() @Min(1) endFrame: number;
}

export class SubmitDatasetClipDto {
  @IsString() @MaxLength(80) exerciseId: string;
  @IsString() @MaxLength(120) exerciseName: string;
  @IsIn(PATTERNS as unknown as string[]) pattern: string;
  @IsIn(['front', 'side', 'diagonal', 'other']) cameraPlacement: 'front' | 'side' | 'diagonal' | 'other';
  @IsIn(['front', 'back']) cameraFacing: 'front' | 'back';
  @IsIn(['portrait', 'landscape']) orientation: 'portrait' | 'landscape';
  @IsString() @MaxLength(40) appVersion: string;
  @IsOptional() @IsInt() @Min(0) @Max(1000) declaredReps?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => RepBoundaryDto)
  repBoundaries?: RepBoundaryDto[];
  @IsInt() fps: number;
  @IsArray() @ArrayMaxSize(MAX_FRAMES) @IsNumber({}, { each: true }) timestampsMs: number[];
  /** N x 132; element values are checked by validatePayload (cheaper than 132 validators). */
  @IsArray() @ArrayMaxSize(MAX_FRAMES) frames: number[][];
}

export class MovementPhaseDto {
  @IsString() @MaxLength(40) name: string;
  @IsInt() @Min(0) startFrame: number;
  @IsInt() @Min(1) endFrame: number;
}

export class AnnotateDatasetClipDto {
  @IsString() @MaxLength(80) exerciseId: string;
  @IsIn(PATTERNS as unknown as string[]) pattern: string;
  @IsIn(['correct', 'incorrect', 'mixed', 'unclear']) correctness: 'correct' | 'incorrect' | 'mixed' | 'unclear';
  @IsOptional() @IsInt() @Min(0) movementStartFrame?: number;
  @IsOptional() @IsInt() @Min(1) movementEndFrame?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => RepBoundaryDto)
  repBoundaries?: RepBoundaryDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => MovementPhaseDto)
  phases?: MovementPhaseDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(120, { each: true })
  formDeviations?: string[];
  @IsIn(['good', 'fair', 'poor']) keypointQuality: 'good' | 'fair' | 'poor';
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @IsIn(['accepted', 'rejected']) decision: 'accepted' | 'rejected';
}

export class DatasetClipQueryDto {
  @IsOptional() @IsIn(['pending_annotation', 'accepted', 'rejected']) status?: string;
  @IsOptional() @IsInt() @Min(1) @Max(100) limit?: number;
}

