import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import type { INestApplication } from '@nestjs/common';

export function swaggerEnabled(env: Record<string, string | undefined>) {
  return env.SWAGGER_ENABLED === 'true' && ['development', 'test'].includes(env.NODE_ENV ?? 'development');
}

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('PhysiqueQuest API').setVersion('1')
    .setDescription('Use session/login or session/register to receive a 15-minute bearer access token and an httpOnly pq_refresh cookie. Send application/json with credentials included to session/refresh; every refresh rotates the cookie. Never store credentials in localStorage. Logout and password changes revoke sessions. Legacy login/register issue transition-only 7-day tokens. Errors contain statusCode, code, message and request_id. Scanner errors retain their documented compatibility envelope.')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .addCookieAuth('pq_refresh', { type: 'apiKey', in: 'cookie', description: 'HttpOnly refresh credential; delivered and rotated by Set-Cookie. Browsers supply it automatically.' }, 'refreshCookie')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  document.components ??= {};
  document.components.schemas ??= {};
  document.components.schemas.StandardError = { type: 'object', required: ['statusCode', 'code', 'message', 'request_id'], properties: {
    statusCode: { type: 'integer', example: 401 }, code: { type: 'string', example: 'HTTP_401' },
    message: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] }, request_id: { type: 'string' },
  } };
  const publicPaths = /^(?:\/(?:health|ready)$|\/api\/(?:v1\/)?(?:config$|account\/recover$|storage\/local\/|auth\/(?:verification\/|login$|register$|session\/(?:login|register|refresh)$|password-reset\/)))/;
  for (const [path, item] of Object.entries(document.paths)) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      const operation = item?.[method];
      if (!operation) continue;
      if (path.endsWith('/auth/session/refresh')) operation.security = [{ refreshCookie: [] }];
      else if (!publicPaths.test(path)) operation.security ??= [{ bearer: [] }];
      for (const status of ['400', '401', '403', '429', '500']) operation.responses[status] ??= {
        description: status === '429' ? 'Rate limit exceeded; respect Retry-After.' : 'Standard API error (scanner routes may use their compatibility envelope).',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardError' } } },
      };
    }
  }
  return document;
}

export function setupOpenApi(app: INestApplication, env = process.env) {
  if (!swaggerEnabled(env)) return;
  app.use('/docs', (_req: unknown, res: { setHeader(name: string, value: string): void }, next: () => void) => {
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'");
    next();
  });
  SwaggerModule.setup('docs', app, createOpenApiDocument(app), { jsonDocumentUrl: 'docs/openapi.json', swaggerOptions: { persistAuthorization: false } });
}
