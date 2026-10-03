import { IsObject } from 'class-validator';
export class UpdateActivityDto { @IsObject() state: Record<string, unknown>; }
