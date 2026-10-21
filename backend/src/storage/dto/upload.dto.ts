import { IsIn, IsInt, Min, Max } from 'class-validator';
export class UploadDto {
  @IsIn(['image/jpeg', 'image/png', 'image/webp']) contentType: string;
  @IsInt() @Min(8) @Max(5242880) size: number;
}
