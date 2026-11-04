import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ChatRateLimitGuard } from './chat-rate-limit.guard.js';
import { ChatService } from './chat.service.js';

class ChatMessage {
  @IsIn(['user', 'assistant']) role: 'user' | 'assistant';
  @IsString() @MinLength(1) @MaxLength(2000) text: string;
}
export class ChatRequest {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(12) @ValidateNested({ each: true }) @Type(() => ChatMessage) messages: ChatMessage[];
  @IsOptional() @IsBoolean() includePersonalData?: boolean;
  @IsOptional() @IsString() @MaxLength(160) page?: string;
}
@Controller('chat')
@UseGuards(JwtAuthGuard, ChatRateLimitGuard)
export class ChatController {
  constructor(private readonly chat: ChatService) {}
  @Get('status') status() { return this.chat.status(); }
  @Post() send(@Req() req: Request & { user: { userId: string } }, @Body() body: ChatRequest) { return this.chat.reply(req.user.userId, body.messages, body.includePersonalData ?? false, body.page); }
}
