import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateProfileDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsNumberString()
  age: string;

  @IsNumberString()
  height: string;

  @IsOptional()
  @Transform(({ value }) => value === '' ? undefined : value)
  @IsNumberString()
  heightInches?: string;

  @IsIn(['cm', 'ft & in.'])
  heightUnit: string;

  @IsNumberString()
  weight: string;

  @IsIn(['kg', 'lbs'])
  weightUnit: string;

  @IsIn(['Male', 'Female', 'Other'])
  gender: string;

  @IsOptional()
  @Transform(({ value }) => value === '' ? undefined : value)
  @IsNumberString()
  chest?: string;

  @IsOptional()
  @Transform(({ value }) => value === '' ? undefined : value)
  @IsNumberString()
  waist?: string;

  @IsOptional()
  @Transform(({ value }) => value === '' ? undefined : value)
  @IsNumberString()
  arms?: string;

  @IsOptional()
  @IsIn(['cm', 'inch'])
  measurementUnit?: string;

  @IsIn(['Sedentary', 'Light', 'Moderate', 'Active', 'Athlete'])
  activity: string;

  @IsString()
  @MaxLength(80)
  goal: string;

  @IsOptional()
  @Transform(({ value }) => value === '' ? undefined : value)
  @IsNumberString()
  targetWeight?: string;

  @IsOptional()
  @Transform(({ value }) => value === '' ? undefined : value)
  @IsDateString()
  targetDate?: string;

  @IsString()
  @MaxLength(40)
  seriousness: string;

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  equipment: string[];

  @IsArray()
  @ArrayMaxSize(7)
  @IsString({ each: true })
  days: string[];

  @IsString()
  @MaxLength(30)
  duration: string;

  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  conditions: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  healthNotes?: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  contactName: string;

  @IsString()
  @MinLength(3)
  @MaxLength(30)
  contactPhone: string;
}

export class UpdateProfileDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) name?: string;
  @IsOptional() @IsNumberString() age?: string;
  @IsOptional() @IsNumberString() height?: string;
  @IsOptional() @Transform(({ value }) => value === '' ? undefined : value) @IsNumberString() heightInches?: string;
  @IsOptional() @IsIn(['cm', 'ft & in.']) heightUnit?: string;
  @IsOptional() @IsNumberString() weight?: string;
  @IsOptional() @IsIn(['kg', 'lbs']) weightUnit?: string;
  @IsOptional() @IsIn(['Male', 'Female', 'Other']) gender?: string;
  @IsOptional() @Transform(({ value }) => value === '' ? undefined : value) @IsNumberString() chest?: string;
  @IsOptional() @Transform(({ value }) => value === '' ? undefined : value) @IsNumberString() waist?: string;
  @IsOptional() @Transform(({ value }) => value === '' ? undefined : value) @IsNumberString() arms?: string;
  @IsOptional() @IsIn(['cm', 'inch']) measurementUnit?: string;
  @IsOptional() @IsIn(['Sedentary', 'Light', 'Moderate', 'Active', 'Athlete']) activity?: string;
  @IsOptional() @IsString() @MaxLength(80) goal?: string;
  @IsOptional() @Transform(({ value }) => value === '' ? undefined : value) @IsNumberString() targetWeight?: string;
  @IsOptional() @Transform(({ value }) => value === '' ? undefined : value) @IsDateString() targetDate?: string;
  @IsOptional() @IsString() @MaxLength(40) seriousness?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) equipment?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(7) @IsString({ each: true }) days?: string[];
  @IsOptional() @IsString() @MaxLength(30) duration?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) conditions?: string[];
  @IsOptional() @IsString() @MaxLength(500) healthNotes?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) contactName?: string;
  @IsOptional() @IsString() @MinLength(3) @MaxLength(30) contactPhone?: string;
}
