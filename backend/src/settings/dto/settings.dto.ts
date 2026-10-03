import { IsObject } from 'class-validator';

export class UpdateSettingsDto {
  @IsObject()
  values: Record<string, unknown>;
}
