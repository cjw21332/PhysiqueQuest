import { describe, expect, it } from 'vitest';
import express from 'express';
import cors from 'cors';
import request from 'supertest';
import { queryValidationMiddleware } from '../src/common/query-validation.middleware.js';

function application() {
  const app = express();
  app.use(queryValidationMiddleware);
  app.use(cors({ origin: 'http://localhost:3000', credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-App-Version'] }));
  app.get(['/api/activity/state', '/api/exercises'], (_req, res) => res.json({ ok: true }));
  return app;
}

describe('query validation before CORS', () => {
  it.each(['/api/activity/state?timezone=Asia%2FSingapore', '/api/exercises?page=1&limit=12'])('allows preflight for %s', async path => {
    const response = await request(application()).options(path)
      .set('Origin', 'http://localhost:3000').set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization,content-type,x-app-version');
    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('still validates the actual GET request and rejects unknown or structured query values', async () => {
    expect((await request(application()).get('/api/activity/state?timezone=Asia%2FSingapore')).status).toBe(200);
    for (const path of ['/api/activity/state?unknown=value', '/api/exercises?search[$ne]=x', '/api/exercises?page=1&page=2']) {
      expect((await request(application()).get(path)).status).toBe(400);
    }
  });
});
