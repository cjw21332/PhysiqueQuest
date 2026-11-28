import { describe, expect, it, vi } from 'vitest';
import { initialPasswordRouteAllowed } from '../auth/jwt-auth.guard.js';
import { queryValidationMiddleware } from '../common/query-validation.middleware.js';
import { Test } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import request from 'supertest';
import { AdminDashboardController } from './admin-dashboard.controller.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { localAdminLoginAllowed } from '../auth/auth.controller.js';

describe('dashboard request boundaries', () => {
  it('only permits setup, account identity and logout before the initial password changes', () => {
    expect(initialPasswordRouteAllowed('GET', '/api/auth/me')).toBe(true);
    expect(initialPasswordRouteAllowed('POST', '/api/v1/auth/admin-initial-password')).toBe(true);
    expect(initialPasswordRouteAllowed('POST', '/api/auth/logout')).toBe(true);
    expect(initialPasswordRouteAllowed('GET', '/api/admin/dashboard/users')).toBe(false);
    expect(initialPasswordRouteAllowed('POST', '/api/other/auth/admin-initial-password')).toBe(false);
    expect(initialPasswordRouteAllowed('POST', '/api/auth/me')).toBe(false);
  });
  it('restricts the development admin identity to loopback development requests', () => {
    expect(localAdminLoginAllowed('http://localhost:3000', '::1', 'development')).toBe(true);
    expect(localAdminLoginAllowed('http://192.168.1.5:3000', '127.0.0.1', 'development')).toBe(false);
    expect(localAdminLoginAllowed('http://localhost:3000', '192.168.1.2', 'development')).toBe(false);
    expect(localAdminLoginAllowed('http://localhost:3000', '127.0.0.1', 'production')).toBe(false);
    expect(localAdminLoginAllowed(undefined, '127.0.0.1', 'development')).toBe(false);
  });
  it('allows dashboard filters but rejects operator-shaped query parameters', () => {
    const next = vi.fn(), status = vi.fn().mockReturnThis(), json = vi.fn();
    queryValidationMiddleware({method:'GET',path:'/api/admin/dashboard/feedback',query:{page:'1',status:'new'}} as never, {status,json} as never, next);
    expect(next).toHaveBeenCalledTimes(1);
    queryValidationMiddleware({method:'GET',path:'/api/admin/dashboard/users',query:{search:{$ne:''}}} as never, {status,json} as never, next);
    expect(status).toHaveBeenCalledWith(400);
  });
  it('rejects a signed-in non-admin before querying user records', async () => {
    const collection = vi.fn();
    const module = await Test.createTestingModule({controllers:[AdminDashboardController],providers:[{provide:getConnectionToken(),useValue:{collection}},RolesGuard]})
      .overrideGuard(JwtAuthGuard).useValue({canActivate:(ctx: any)=>{ctx.switchToHttp().getRequest().user={userId:'507f1f77bcf86cd799439011',role:'user'};return true;}}).compile();
    const app = module.createNestApplication(); await app.init();
    try { const result = await request(app.getHttpServer()).get('/admin/dashboard/users'); expect(result.status).toBe(403); expect(collection).not.toHaveBeenCalled(); }
    finally { await app.close(); }
  });
});
