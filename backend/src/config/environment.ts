import { retention, retentionDefaults } from '../privacy/retention.js';

export function validateEnvironment(env: Record<string, unknown>) {
  const read = (name: string) => String(env[name] ?? '').trim();
  const fail = (name: string): never => { throw new Error(`Invalid or missing ${name}`); };
  for (const name of Object.keys(retentionDefaults) as Array<keyof typeof retentionDefaults>) retention(name, env as NodeJS.ProcessEnv);
  if (read('SWAGGER_ENABLED') && !['true', 'false'].includes(read('SWAGGER_ENABLED'))) fail('SWAGGER_ENABLED');
  for (const name of ['EMAIL_VERIFICATION_ENFORCED', 'S3_FORCE_PATH_STYLE']) if (read(name) && !['true', 'false'].includes(read(name))) fail(name);
  if (read('PUSH_PROVIDER') && !['dry-run', 'expo'].includes(read('PUSH_PROVIDER'))) fail('PUSH_PROVIDER');
  if (read('STORAGE_DRIVER') && !['local', 's3'].includes(read('STORAGE_DRIVER'))) fail('STORAGE_DRIVER');
  if (read('MAIL_PROVIDER') && !['console', 'mailpit', 'resend', 'brevo'].includes(read('MAIL_PROVIDER'))) fail('MAIL_PROVIDER');
  if (read('EMAIL_VERIFICATION_TTL_MINUTES') && (!/^\d+$/.test(read('EMAIL_VERIFICATION_TTL_MINUTES')) || Number(read('EMAIL_VERIFICATION_TTL_MINUTES')) < 1 || Number(read('EMAIL_VERIFICATION_TTL_MINUTES')) > 1440)) fail('EMAIL_VERIFICATION_TTL_MINUTES');
  if (read('EMAIL_VERIFICATION_ENFORCED') === 'true' && (read('REQUIRE_APP_VERSION') !== 'true' || !read('MIN_APP_VERSION'))) fail('REQUIRE_APP_VERSION');
  if (['resend', 'brevo'].includes(read('MAIL_PROVIDER')) && (!read('MAIL_API_KEY') || !read('MAIL_FROM'))) fail('MAIL_API_KEY');
  if (read('STORAGE_DRIVER') === 's3' && !read('S3_BUCKET')) fail('S3_BUCKET');
  if (Boolean(read('S3_ACCESS_KEY_ID')) !== Boolean(read('S3_SECRET_ACCESS_KEY'))) fail('S3_SECRET_ACCESS_KEY');
  for (const name of ['EMAIL_VERIFICATION_URL', 'MAILPIT_URL', 'S3_ENDPOINT', 'CDN_BASE_URL', 'SENTRY_DSN']) if (read(name)) {
    try { const url = new URL(read(name)); if (!['http:', 'https:'].includes(url.protocol) || (read('NODE_ENV') === 'production' && url.protocol !== 'https:')) fail(name); } catch { fail(name); }
  }
  if (read('HEALTH_DATA_ENCRYPTION_KEY')) {
    const key = Buffer.from(read('HEALTH_DATA_ENCRYPTION_KEY'), 'base64');
    if (key.length !== 32 || key.toString('base64') !== read('HEALTH_DATA_ENCRYPTION_KEY')) fail('HEALTH_DATA_ENCRYPTION_KEY');
  }
  if (read('CDN_BASE_URL')) {
    const key = Buffer.from(read('CDN_SIGNING_KEY'), 'base64');
    if (read('STORAGE_DRIVER') !== 's3' || key.length !== 32 || key.toString('base64') !== read('CDN_SIGNING_KEY')) fail('CDN_SIGNING_KEY');
  }
  if (read('NODE_ENV') && !['development', 'test', 'production'].includes(read('NODE_ENV'))) fail('NODE_ENV');
  if (!/^mongodb(?:\+srv)?:\/\//.test(read('MONGODB_URI'))) fail('MONGODB_URI');
  if (!read('JWT_SECRET')) fail('JWT_SECRET');
  if (read('JWT_EXPIRES_IN')) {
    const match = /^(\d+)(s|m|h|d)$/.exec(read('JWT_EXPIRES_IN'));
    const seconds = match ? Number(match[1]) * ({ s: 1, m: 60, h: 3600, d: 86400 }[match[2]] ?? 0) : 0;
    if (seconds < 1 || seconds > 7 * 86400) fail('JWT_EXPIRES_IN');
  }
  for (const name of ['PORT', 'DB_MAX_POOL_SIZE']) {
    if (read(name) && (!/^\d+$/.test(read(name)) || Number(read(name)) < 1 || Number(read(name)) > (name === 'PORT' ? 65535 : 200))) fail(name);
  }
  if (read('MIN_APP_VERSION') && !/^\d{1,5}\.\d{1,5}\.\d{1,5}$/.test(read('MIN_APP_VERSION'))) fail('MIN_APP_VERSION');
  if (read('REQUIRE_APP_VERSION') && !['true', 'false'].includes(read('REQUIRE_APP_VERSION'))) fail('REQUIRE_APP_VERSION');
  if (read('REQUIRE_APP_VERSION') === 'true' && !read('MIN_APP_VERSION')) fail('MIN_APP_VERSION');
  if (read('LEGACY_AUTH_ENABLED') && !['true', 'false'].includes(read('LEGACY_AUTH_ENABLED'))) fail('LEGACY_AUTH_ENABLED');
  if (read('LEGACY_AUTH_ENABLED') === 'false' && (read('REQUIRE_APP_VERSION') !== 'true' || !read('MIN_APP_VERSION'))) fail('REQUIRE_APP_VERSION');
  if (read('COOKIE_SECURE') && !['true', 'false'].includes(read('COOKIE_SECURE'))) fail('COOKIE_SECURE');
  if (read('COOKIE_SAMESITE') && !['lax', 'strict', 'none'].includes(read('COOKIE_SAMESITE'))) fail('COOKIE_SAMESITE');
  if (read('COOKIE_SAMESITE') === 'none' && read('COOKIE_SECURE') !== 'true') fail('COOKIE_SECURE');
  if (read('COOKIE_DOMAIN') && !/^\.?[a-z0-9.-]+$/i.test(read('COOKIE_DOMAIN'))) fail('COOKIE_DOMAIN');
  if (read('TRUST_PROXY') && !/^[0-5]$/.test(read('TRUST_PROXY'))) fail('TRUST_PROXY');
  if (read('CORS_ALLOWED_ORIGINS').includes('*')) fail('CORS_ALLOWED_ORIGINS');
  if (read('API_PUBLIC_URL').includes(',')) fail('API_PUBLIC_URL');
  if (read('NODE_ENV') === 'production') {
    if (['console', 'mailpit'].includes(read('MAIL_PROVIDER'))) fail('MAIL_PROVIDER');
    if (read('STORAGE_DRIVER') !== 's3') fail('STORAGE_DRIVER');
    if (!read('HEALTH_DATA_ENCRYPTION_KEY')) fail('HEALTH_DATA_ENCRYPTION_KEY');
    if (read('JWT_SECRET').length < 32 || /replace|example|changeme|test.secret/i.test(read('JWT_SECRET'))) fail('JWT_SECRET');
    if (read('COOKIE_SECURE') === 'false') fail('COOKIE_SECURE');
    for (const name of [read('CORS_ALLOWED_ORIGINS') ? 'CORS_ALLOWED_ORIGINS' : 'FRONTEND_URL', 'API_PUBLIC_URL']) {
      if (!read(name)) fail(name);
      for (const origin of read(name).split(',')) {
        let url: URL;
        try { url = new URL(origin.trim()); } catch { fail(name); }
        if (url!.protocol !== 'https:' || url!.username || url!.password || url!.pathname !== '/' || url!.search || url!.hash) fail(name);
      }
    }
    for (const prefix of ['ALERT_DELIVERY', 'POSE_ANALYSIS', 'EMAIL_DELIVERY']) {
      if (Boolean(read(`${prefix}_URL`)) !== Boolean(read(`${prefix}_API_KEY`))) fail(prefix);
      if (read(`${prefix}_URL`)) {
        try { if (new URL(read(`${prefix}_URL`)).protocol !== 'https:') fail(`${prefix}_URL`); } catch { fail(`${prefix}_URL`); }
      }
    }
  }
  return env;
}
