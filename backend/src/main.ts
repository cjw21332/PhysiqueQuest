import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import type { CustomOrigin } from '@nestjs/common/interfaces/external/cors-options.interface';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  const configService = app.get(ConfigService);

  const configuredOrigins = (configService.get<string>('FRONTEND_URL') || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  // Expo Go loads the Next app from the development computer's private LAN IP.
  // Allow only that dev origin on port 3000; production remains explicit.
  app.enableCors({
    origin: ((origin, callback) => {
      if (!origin || configuredOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      const isDevelopment = configService.get<string>('NODE_ENV') !== 'production';
      let parsed: URL | undefined;
      try { parsed = new URL(origin); } catch { /* reject malformed origins below */ }
      const octets = parsed?.hostname.split('.').map(Number);
      const isPrivateLanAddress = !!octets && octets.length === 4 && octets.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) && (
        octets[0] === 10 ||
        (octets[0] === 192 && octets[1] === 168) ||
        (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
      );
      if (isDevelopment && parsed?.protocol === 'http:' && parsed.port === '3000' && isPrivateLanAddress) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin is not allowed by CORS'));
    }) satisfies CustomOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global prefix for all routes
  app.setGlobalPrefix('api');

  const port = configService.get('PORT') || 4000;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Backend server running on http://0.0.0.0:${port}/api`);
}
await bootstrap();
