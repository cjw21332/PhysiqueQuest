import { ArrayMaxSize, IsArray, IsBase64, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
export class PoseAnalysisDto {
  @IsString() @MinLength(4) @IsBase64() @MaxLength(28_000_000) mediaBase64: string;
  @IsIn(['video/mp4', 'video/quicktime', 'image/jpeg', 'image/png']) mimeType: string;
  @IsOptional() @IsIn(['workout', 'readiness']) analysisType?: 'workout' | 'readiness';
  @IsOptional() @IsArray() @ArrayMaxSize(3) @IsIn(['fullBodyInFrame', 'lighting', 'distance'], { each: true }) requestedChecks?: ('fullBodyInFrame' | 'lighting' | 'distance')[];
  @IsOptional() @IsInt() @Min(1) @Max(120) durationSeconds?: number;
  @IsOptional() @IsIn(['chest_press', 'squat']) exerciseHint?: 'chest_press' | 'squat';
}
