import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { StandaloneCoachModule } from '../src/coach/standalone-coach.module.js';
import { ExerciseDbService } from '../src/exercises/exercisedb.service.js';

describe('standalone coach HTTP without database or account modules', () => {
  let app: INestApplication;
  const catalog = { findAll: vi.fn().mockResolvedValue({ items: [], total: 0, source: 'ExerciseDB V1' }), findBySlug: vi.fn().mockResolvedValue({ _id: 'provider-id', gifUrl: 'https://static.exercisedb.dev/media/provider-id.gif' }), getForPlan: vi.fn().mockResolvedValue([]) };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [StandaloneCoachModule] }).overrideProvider(ExerciseDbService).useValue(catalog).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });
  afterAll(async () => { await app.close(); });

  it('serves a public source status and provider detail with no token', async () => {
    const status = await request(app.getHttpServer()).get('/api/coach/status').expect(200);
    expect(status.body).toMatchObject({ source: 'ExerciseDB V1', persistence: 'stateless', media: 'GIF' });
    const detail = await request(app.getHttpServer()).get('/api/exercises/provider-id').expect(200);
    expect(detail.body._id).toBe('provider-id');
    expect(detail.headers['cache-control']).toBe('public, max-age=30');
    expect(detail.headers.etag).toBeTruthy();
    await request(app.getHttpServer()).get('/api/exercises/provider-id').set('If-None-Match', detail.headers.etag).expect(304);
    await request(app.getHttpServer()).get('/api/exercises?muscle=Chest&page=2&limit=12').expect(200);
    expect(catalog.findAll).toHaveBeenCalledWith({ muscle: 'Chest', page: 2, limit: 12 });
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
