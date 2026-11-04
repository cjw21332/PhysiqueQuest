import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { UnauthorizedException, ValidationPipe, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ChatRateLimitGuard } from './chat-rate-limit.guard.js';

describe('chat HTTP authentication and input contract', () => {
  let app: INestApplication;
  const reply = vi.fn(async () => ({ reply: 'Home guide', sources: [], privacy: { personalDataIncluded: false, historyStored: false, provider: 'self-hosted' } }));
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [ChatController], providers: [
      { provide: ChatService, useValue: { reply, status: async () => ({ ready: true }) } }, ChatRateLimitGuard,
    ] }).overrideGuard(JwtAuthGuard).useValue({ canActivate(context: any) {
      const req = context.switchToHttp().getRequest();
      if (req.headers.authorization !== 'Bearer synthetic-session') throw new UnauthorizedException();
      req.user = { userId: 'aaaaaaaaaaaaaaaaaaaaaaaa' }; return true;
    } }).compile();
    app = module.createNestApplication(); app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });
  afterAll(async () => app?.close());
  it('rejects anonymous access', async () => {
    await request(app.getHttpServer()).post('/chat').send({ messages: [{ role: 'user', text: 'Home' }] }).expect(401);
    expect(reply).not.toHaveBeenCalled();
    await request(app.getHttpServer()).get('/chat/status').expect(401);
  });
  it.each([
    { messages: [{ role: 'user', text: 'Home' }], userId: 'bbbbbbbbbbbbbbbbbbbbbbbb' },
    { messages: [{ role: 'system', text: 'Home' }] }, { messages: [] },
    { messages: [{ role: 'user', text: 'Home' }], includePersonalData: 'true' },
    { messages: [{ role: 'user', text: 'Home', userId: 'bbbbbbbbbbbbbbbbbbbbbbbb' }] },
  ])('rejects identity overrides, roles and malformed bodies %j', async body => {
    await request(app.getHttpServer()).post('/chat').auth('synthetic-session', { type: 'bearer' }).send(body).expect(400);
  });
  it('passes only guard identity and explicit consent to service', async () => {
    await request(app.getHttpServer()).post('/chat').auth('synthetic-session', { type: 'bearer' }).send({ messages: [{ role: 'user', text: 'Home' }], includePersonalData: true }).expect(201);
    expect(reply).toHaveBeenLastCalledWith('aaaaaaaaaaaaaaaaaaaaaaaa', [{ role: 'user', text: 'Home' }], true, undefined);
  });
  it('accepts an application-page hint and keeps model readiness authenticated', async () => {
    await request(app.getHttpServer()).post('/chat').auth('synthetic-session', { type: 'bearer' }).send({ messages: [{ role: 'user', text: 'What can I do here?' }], page: '/scan/plan' }).expect(201);
    expect(reply).toHaveBeenLastCalledWith('aaaaaaaaaaaaaaaaaaaaaaaa', [{ role: 'user', text: 'What can I do here?' }], false, '/scan/plan');
    const response = await request(app.getHttpServer()).get('/chat/status').auth('synthetic-session', { type: 'bearer' }).expect(200);
    expect(response.body).toEqual({ ready: true });
  });
});
