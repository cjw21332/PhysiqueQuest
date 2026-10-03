import { IsBoolean } from 'class-validator';
export class NotificationReadDto { @IsBoolean() unread: boolean; }
