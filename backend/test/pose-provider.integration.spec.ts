import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { PoseAnalysisProvider } from '../src/providers/pose-analysis.provider.js';
import { PoseService } from '../src/pose/pose.service.js';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { json } from 'express';
import request from 'supertest';
import { PoseController } from '../src/pose/pose.controller.js';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard.js';
import { AiRateLimitGuard } from '../src/common/ai-rate-limit.guard.js';

const root = resolve(process.cwd(), '..');
const python = resolve(root, 'pose-service', '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
let child: ChildProcess | undefined;
afterAll(() => child?.kill());

describe.skipIf(!existsSync(python))('self-hosted pose provider', () => {
  it('runs the existing backend contract against the real service', async () => {
    const listener = createServer();
    await new Promise<void>(resolvePromise => listener.listen(0, '127.0.0.1', resolvePromise));
    const port = (listener.address() as { port: number }).port;
    await new Promise<void>(resolvePromise => listener.close(() => resolvePromise()));
    const key = randomBytes(32).toString('hex');
    child = spawn(python, ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', String(port), '--no-access-log'], { cwd: resolve(root, 'pose-service'), env: { ...process.env, POSE_ANALYSIS_API_KEY: key }, stdio: 'ignore', windowsHide: true });
    const url = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let i = 0; i < 300 && !ready; i++) {
      try { ready = (await fetch(`${url}/health`)).ok; } catch { await new Promise(resolvePromise => setTimeout(resolvePromise, 100)); }
    }
    expect(ready).toBe(true);
    const config = { get: (name: string) => name === 'POSE_ANALYSIS_URL' ? `${url}/analyze` : name === 'POSE_ANALYSIS_API_KEY' ? key : undefined };
    const service = new PoseService(new PoseAnalysisProvider(config as never));
    expect(await service.status()).toEqual({ available: true });
    const clip = readFileSync(resolve(root, 'frontend/public/opening-app-animation.mp4'));
    const result = await service.analyze({ mediaBase64: clip.toString('base64'), mimeType: 'video/mp4', analysisType: 'workout' });
    expect(result).toMatchObject({ observations: expect.arrayContaining([expect.stringContaining('Pose landmarks were detected')]), movementEstimate: null });
    const suppliedClip = process.env.PQ_POSE_TEST_VIDEO;
    if (suppliedClip) {
      const moduleRef = await Test.createTestingModule({ controllers: [PoseController], providers: [PoseService] })
        .overrideProvider(PoseService).useValue(service)
        .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
        .overrideGuard(AiRateLimitGuard).useValue({ canActivate: () => true }).compile();
      const app = moduleRef.createNestApplication({ bodyParser: false });
      app.use(json({ limit: '28mb' }));
      app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
      await app.init();
      try {
        const response = await request(app.getHttpServer()).post('/pose/analyze').send({ mediaBase64: readFileSync(suppliedClip).toString('base64'), mimeType: 'video/mp4', analysisType: 'workout' });
        expect(response.status).toBe(201);
        expect(response.body.metrics.detectedFrames).toBeGreaterThan(0);
      } finally { await app.close(); }
    }
  }, 60_000);
});
