import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsNumber, IsOptional, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class AlertLocationDto {
  @IsNumber() @Min(-90) @Max(90) lat: number;
  @IsNumber() @Min(-180) @Max(180) lng: number;
  @IsNumber() @Min(0) @Max(10000) accuracyMeters: number;
  @IsDateString({ strict: true, strictSeparator: true }) capturedAt: string;
}

export class CreateAlertDto {
  @Matches(/^[A-Za-z0-9._:-]{12,100}$/) idempotencyKey: string;
  @IsIn(['manual', 'inactivity', 'cancelled']) eventType: 'manual' | 'inactivity' | 'cancelled';
  @IsOptional() @ValidateNested() @Type(() => AlertLocationDto) location?: AlertLocationDto;
  @IsOptional() @Matches(/^[a-f\d]{24}$/i) workoutSessionId?: string;
  @IsOptional() @MaxLength(80) exerciseId?: string;
}
