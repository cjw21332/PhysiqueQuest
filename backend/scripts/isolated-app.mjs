import { loadEnvFile } from 'node:process';
import { randomBytes } from 'node:crypto';
import { getConnectionToken } from '@nestjs/mongoose';

export async function startIsolatedApp(port = 0) {
  try { loadEnvFile('.env'); } catch { /* Runner may supply environment. */ }
  if (!process.env.MONGODB_URI) throw Error('MONGODB_URI is required for isolated verification');
  const database = `pq_security_test_${randomBytes(8).toString('hex')}`;
  process.env.MONGODB_URI = process.env.MONGODB_URI.replace(/^(mongodb(?:\+srv)?:\/\/[^/]+)(?:\/[^?]*)?/, `$1/${database}`);
  process.env.JWT_SECRET = randomBytes(48).toString('hex');
  process.env.HEALTH_DATA_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  process.env.COOKIE_SECURE = 'false';
  process.env.COOKIE_SAMESITE = 'lax';
  process.env.MAIL_PROVIDER = 'console';
  process.env.PUSH_PROVIDER = 'dry-run';
  process.env.STORAGE_DRIVER = 'local';
  process.env.EMAIL_VERIFICATION_ENFORCED = 'false';
  process.env.CORS_ALLOWED_ORIGINS = 'http://127.0.0.1:4310,http://localhost:4310';
  for (const name of ['GEMINI_API_KEY', 'USDA_API_KEY', 'EMAIL_DELIVERY_URL', 'EMAIL_DELIVERY_API_KEY', 'SERVICE_ID', 'TEMPLATE_ID', 'PUBLIC_KEY', 'EMAILJS_PRIVATE_KEY', 'EMAILJS_SERVICE_ID', 'EMAILJS_TEMPLATE_ID', 'EMAILJS_PUBLIC_KEY', 'ALERT_DELIVERY_URL', 'ALERT_DELIVERY_API_KEY', 'POSE_ANALYSIS_URL', 'POSE_ANALYSIS_API_KEY', 'COOKIE_DOMAIN', 'MIN_APP_VERSION', 'REQUIRE_APP_VERSION']) delete process.env[name];
  const { createApplication } = await import('../dist/application.js');
  const app = await createApplication();
  const connection = app.get(getConnectionToken());
  if (connection.name !== database || !/^pq_security_test_[a-f0-9]{16}$/.test(connection.name)) { await app.close(); throw Error('Unsafe verification database'); }
  await app.listen(port, '127.0.0.1');
  let stopped = false;
  const close = async () => {
    if (stopped) return;
    stopped = true;
    try { await connection.dropDatabase(); } finally { await app.close(); }
  };
  return { app, connection, url: await app.getUrl(), close };
}
