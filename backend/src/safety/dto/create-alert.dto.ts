import { IsIn, Matches } from 'class-validator';
export class CreateAlertDto {
  @Matches(/^[A-Za-z0-9._:-]{12,100}$/) idempotencyKey: string;
  @IsIn(['manual']) eventType: 'manual';
}
