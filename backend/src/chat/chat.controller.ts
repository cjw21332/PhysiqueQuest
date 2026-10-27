import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsIn, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CoachRateLimitGuard } from '../coach/coach-rate-limit.guard.js';
import { ChatService } from './chat.service.js';

class ChatMessage {
  @IsIn(['user', 'assistant']) role: 'user' | 'assistant';
  @IsString() @MinLength(1) @MaxLength(2000) text: string;
}
class ChatRequest {
  @IsArray() @ArrayMaxSize(12) @ValidateNested({ each: true }) @Type(() => ChatMessage) messages: ChatMessage[];
}
@Controller('chat')
@UseGuards(JwtAuthGuard, CoachRateLimitGuard)
export class ChatController {
  constructor(private readonly chat: ChatService) {}
  @Post() send(@Req() req: Request & { user: { userId: string } }, @Body() body: ChatRequest) { return this.chat.reply(req.user.userId, body.messages); }
}
