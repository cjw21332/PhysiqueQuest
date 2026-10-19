import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard.js';
import { WorkoutsController } from '../src/workouts/workouts.controller.js';
import { WorkoutsService } from '../src/workouts/workouts.service.js';
import { ValidationPipe } from '@nestjs/common';

const USER = '507f1f77bcf86cd799439011';

describe('GET /workouts/active JSON contract', () => {
  for (const workout of [null, { _id: '507f1f77bcf86cd799439012', userId: USER, status: 'active' }]) {
    it(`returns parseable JSON for ${workout ? 'an active session' : 'no active session'}`, async () => {
      const service = { active: vi.fn(async () => workout) };
      const moduleRef = await Test.createTestingModule({ controllers: [WorkoutsController], providers: [WorkoutsService] })
        .overrideProvider(WorkoutsService).useValue(service)
        .overrideGuard(JwtAuthGuard).useValue({ canActivate: (context: any) => {
          context.switchToHttp().getRequest().user = { userId: USER };
          return true;
        } })
        .compile();
      const app = moduleRef.createNestApplication();
      await app.init();
      try {
        const response = await request(app.getHttpServer()).get('/workouts/active');
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toContain('application/json');
        expect(JSON.parse(response.text)).toEqual(workout);
        expect(service.active).toHaveBeenCalledWith(USER);
      } finally {
        await app.close();
      }
    });
  }
});

describe('POST /workouts/recorded/:id/apply', () => {
  it('uses the authenticated owner and validates the submitted plan before calling the service', async () => {
    const recordingId = '507f1f77bcf86cd799439012';
    const service = { applyRecording: vi.fn(async () => ({ _id: 'planned-session', status: 'active' })) };
    const moduleRef = await Test.createTestingModule({ controllers: [WorkoutsController], providers: [WorkoutsService] })
      .overrideProvider(WorkoutsService).useValue(service)
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: (context: any) => { context.switchToHttp().getRequest().user = { userId: USER }; return true; } })
      .compile();
    const app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    const plan = { programVersion: 'current', scheduledDate: '2026-10-12', dayIndex: 0, timezone: 'Asia/Taipei', exerciseId: 'pushup', exercises: [{ exerciseId: 'pushup', name: 'Push-up', equipment: 'Bodyweight', sets: 3 }] };
    try {
      const response = await request(app.getHttpServer()).post(`/workouts/recorded/${recordingId}/apply`).send(plan);
      expect(response.status).toBe(201);
      expect(service.applyRecording).toHaveBeenCalledWith(USER, recordingId, expect.objectContaining(plan));
      const rejected = await request(app.getHttpServer()).post(`/workouts/recorded/${recordingId}/apply`).send({ ...plan, userId: 'someone-else' });
      expect(rejected.status).toBe(400);
      expect(service.applyRecording).toHaveBeenCalledTimes(1);
    } finally { await app.close(); }
  });
});
