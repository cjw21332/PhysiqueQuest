import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
export class PoseAnalysisDto {
  @IsString() @MinLength(4) @Matches(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/) @MaxLength(28_000_000) mediaBase64: string;
  @IsIn(['video/mp4', 'video/quicktime', 'image/jpeg', 'image/png']) mimeType: string;
  @IsOptional() @IsInt() @Min(1) @Max(120) durationSeconds?: number;
}
