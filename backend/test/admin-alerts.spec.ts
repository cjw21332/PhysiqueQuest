import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard.js';
import { RolesGuard } from '../src/auth/roles.guard.js';
import { AdminAlertsController } from '../src/admin/admin-alerts.controller.js';
import { AdminAlertsService } from '../src/admin/admin-alerts.service.js';

const OWNER = '507f1f77bcf86cd799439011';
const ALERT = '507f1f77bcf86cd799439013';

// Mimics the chained Mongoose query shape: find().sort().limit().lean().exec()
const query = (rows: unknown[]) => {
  const chain: any = {};
  for (const step of ['sort', 'limit', 'lean']) chain[step] = () => chain;
  chain.exec = async () => rows;
  return chain;
};

function makeService(events: any[], people: any[] = [{ _id: OWNER, name: 'Maria Dela Cruz' }]) {
  const alerts = { find: vi.fn(() => query(events)) };
  const users = { find: vi.fn(() => query(people)) };
  return { service: new AdminAlertsService(alerts as any, users as any), alerts, users };
}

describe('AdminAlertsService.list', () => {
  it('rejects an unknown status filter', async () => {
    const { service } = makeService([]);
    await expect(service.list(30, 'bogus')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a range outside 7, 30, 90', async () => {
    const { service } = makeService([]);
    await expect(service.list(14)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns names in one lookup and reports location only as a boolean', async () => {
    const { service, users } = makeService([
      { _id: ALERT, userId: OWNER, eventType: 'inactivity', status: 'delivered', occurredAt: new Date(), flagged: true, exerciseId: 'exercise-2', location: { lat: 14.6, lng: 121, accuracyMeters: 9, capturedAt: new Date() } },
    ]);
    const [row] = await service.list(30);
    expect(row.userName).toBe('Maria Dela Cruz');
    expect(row.locationShared).toBe(true);
    expect(row).not.toHaveProperty('location');
    expect(users.find).toHaveBeenCalledOnce();
  });
});

describe('GET /admin/alerts access', () => {
  it('returns 403 for a non-admin user', async () => {
    const service = { list: vi.fn(async () => []) };
    const moduleRef = await Test.createTestingModule({ controllers: [AdminAlertsController], providers: [{ provide: AdminAlertsService, useValue: service }, RolesGuard] })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: (ctx: any) => { ctx.switchToHttp().getRequest().user = { userId: OWNER, role: 'user' }; return true; } })
      .compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    try {
      const res = await request(app.getHttpServer()).get('/admin/alerts?days=30');
      expect(res.status).toBe(403);
      expect(service.list).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('passes days and status through for an admin user', async () => {
    const service = { list: vi.fn(async () => []) };
    const moduleRef = await Test.createTestingModule({ controllers: [AdminAlertsController], providers: [{ provide: AdminAlertsService, useValue: service }, RolesGuard] })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: (ctx: any) => { ctx.switchToHttp().getRequest().user = { userId: OWNER, role: 'admin' }; return true; } })
      .compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    try {
      const res = await request(app.getHttpServer()).get('/admin/alerts?days=7&status=failed');
      expect(res.status).toBe(200);
      expect(service.list).toHaveBeenCalledWith(7, 'failed');
    } finally {
      await app.close();
    }
  });
});

void ForbiddenException;
