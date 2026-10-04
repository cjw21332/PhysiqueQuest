import { IsDateString, IsIn, IsNumber, Max, Min } from 'class-validator';

export class CreateProgressDto {
  @IsIn(['weight', 'waist', 'benchPress']) metric: 'weight' | 'waist' | 'benchPress';
  @IsNumber() @Min(0.1) @Max(1000) value: number;
  @IsIn(['kg', 'lb', 'cm', 'in']) unit: 'kg' | 'lb' | 'cm' | 'in';
  @IsDateString({ strict: true, strictSeparator: true }) measuredAt: string;
}
