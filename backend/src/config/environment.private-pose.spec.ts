import { describe, expect, it } from 'vitest';
import { validateEnvironment } from './environment.js';

const production = {
  NODE_ENV: 'production', MONGODB_URI: 'mongodb://db.example/test',
  JWT_SECRET: 'a'.repeat(48), HEALTH_DATA_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
  STORAGE_DRIVER: 's3', S3_BUCKET: 'test-bucket', MAIL_PROVIDER: 'resend', MAIL_API_KEY: 'test', MAIL_FROM: 'test@example.invalid',
  FRONTEND_URL: 'https://example.invalid', API_PUBLIC_URL: 'https://example.invalid',
  POSE_ANALYSIS_URL: 'http://pose:8000/analyze', POSE_ANALYSIS_API_KEY: 'test',
};

describe('private pose deployment', () => {
  it('permits the exact private Docker endpoint only when explicitly enabled', () => {
    expect(() => validateEnvironment(production)).toThrow('POSE_ANALYSIS_URL');
    expect(() => validateEnvironment({ ...production, POSE_ANALYSIS_PRIVATE_DOCKER: 'true' })).not.toThrow();
  });
  it('does not permit another HTTP host or path', () => {
    for (const url of ['http://attacker.invalid/analyze', 'http://pose:8000/other', 'http://pose:8000/analyze?x=1']) {
      expect(() => validateEnvironment({ ...production, POSE_ANALYSIS_PRIVATE_DOCKER: 'true', POSE_ANALYSIS_URL: url })).toThrow('POSE_ANALYSIS_URL');
    }
  });
});
