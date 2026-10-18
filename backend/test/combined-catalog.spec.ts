import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { UnauthorizedException, ValidationPipe, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { CoachPreviewModule } from '../src/coach/coach-preview.module.js';
import { ExerciseLibraryModule } from '../src/exercises/exercise-library.module.js';
import { CoachController } from '../src/coach/coach.controller.js';
import { CoachService } from '../src/coach/coach.service.js';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard.js';
import { AdminExercisesController } from '../src/exercises/exercises.controller.js';
import { AdminExercisesService } from '../src/exercises/exercises.service.js';
import { RolesGuard } from '../src/auth/roles.guard.js';
import { ExerciseDbService } from '../src/exercises/exercisedb.service.js';

describe('combined API public catalog, preview and protected user/admin routes', () => {
  let app: INestApplication;
  const catalog = { findAll: vi.fn().mockResolvedValue({ items: [], total: 0, source: 'ExerciseDB V1' }), findBySlug: vi.fn().mockResolvedValue({ _id: 'provider-id', gifUrl: 'https://static.exercisedb.dev/media/provider-id.gif' }), getForPlan: vi.fn().mockResolvedValue([]) };
  const saved = { getPlan: vi.fn(async userId => ({ userId, programVersion: 'saved-program' })) };
  const admin = { list: vi.fn(async () => []) };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [CoachPreviewModule, ExerciseLibraryModule], controllers: [CoachController, AdminExercisesController],
      providers: [{ provide: CoachService, useValue: saved }, { provide: AdminExercisesService, useValue: admin }, RolesGuard],
    }).overrideProvider(ExerciseDbService).useValue(catalog).overrideGuard(JwtAuthGuard).useValue({
      canActivate(context: any) {
        const req = context.switchToHttp().getRequest();
        if (req.headers.authorization !== 'Bearer fixture-token') throw new UnauthorizedException();
        req.user = { userId: 'fixture-user', role: 'user' }; return true;
      },
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });
  afterAll(async () => { await app.close(); });

  it('serves public provider detail and browse from the same HTTP listener with no token', async () => {
    const detail = await request(app.getHttpServer()).get('/api/exercises/provider-id').expect(200);
    expect(detail.body._id).toBe('provider-id');
    await request(app.getHttpServer()).get('/api/exercises?muscle=Chest&page=2&limit=12').expect(200);
    expect(catalog.findAll).toHaveBeenCalledWith(expect.objectContaining({ muscle: 'Chest', page: 2, limit: 12 }));
  });

  it('keeps saved programs bound to the authenticated user and admin catalog role-protected', async () => {
    await request(app.getHttpServer()).get('/api/coach/plan').expect(401);
    expect(saved.getPlan).not.toHaveBeenCalled();
    const response = await request(app.getHttpServer()).get('/api/coach/plan').set('Authorization', 'Bearer fixture-token').expect(200);
    expect(response.body).toMatchObject({ userId: 'fixture-user', programVersion: 'saved-program' });
    await request(app.getHttpServer()).get('/api/admin/exercises').expect(401);
    await request(app.getHttpServer()).get('/api/admin/exercises').set('Authorization', 'Bearer fixture-token').expect(403);
    expect(admin.list).not.toHaveBeenCalled();
  });

  it('accepts validated program context and rejects missing context before provider work', async () => {
    const context = { goal: 'General fitness', days: ['Monday', 'Friday'], duration: '30 min', equipment: ['Bodyweight'], conditions: [] };
    const plan = await request(app.getHttpServer()).post('/api/coach/plan').send({ profile: context }).expect(201);
    expect(plan.body).toMatchObject({ sessionCount: 2, duration: '30 min', libraryReady: false, source: 'ExerciseDB V1' });
    expect(catalog.getForPlan).toHaveBeenCalledTimes(1);
    await request(app.getHttpServer()).post('/api/coach/plan').send({ profile: { ...context, days: ['Monday', 'Monday'] } }).expect(400);
    expect(catalog.getForPlan).toHaveBeenCalledTimes(1);
  });

  it('accepts saved legacy weekday initials without losing Tuesday or Thursday', async () => {
    const plan = await request(app.getHttpServer()).post('/api/coach/plan').send({ profile: {
      goal: 'Build muscle', days: ['M', 'T', 'W', 'T', 'F'], duration: '60 min', equipment: ['Dumbbells'], conditions: [],
    } }).expect(201);
    expect(plan.body.sessionCount).toBe(5);
    expect(plan.body.days.filter((day: any) => day.isWorkoutDay).map((day: any) => day.name)).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  });

  it('supports indexed legacy weekdays but continues to reject invalid or duplicate days', async () => {
    const profile = { goal: 'General fitness', days: ['T-3', 'S-6'], duration: '30 min', equipment: ['Bodyweight only'], conditions: [] };
    const plan = await request(app.getHttpServer()).post('/api/coach/plan').send({ profile }).expect(201);
    expect(plan.body.days.filter((day: any) => day.isWorkoutDay).map((day: any) => day.name)).toEqual(['Thursday', 'Sunday']);
    for (const days of [['M', 'M'], ['T', 'T', 'T'], ['Monday', 'M'], ['Someday']]) {
      await request(app.getHttpServer()).post('/api/coach/plan').send({ profile: { ...profile, days } }).expect(400);
    }
  });
});
