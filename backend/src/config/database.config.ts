import { ConfigService } from '@nestjs/config';
import { MongooseModuleOptions } from '@nestjs/mongoose';

export const getDatabaseConfig = (
  configService: ConfigService,
): MongooseModuleOptions => ({
  uri: configService.getOrThrow<string>('MONGODB_URI'),
  retryAttempts: 5,
  retryDelay: 3000,
  maxPoolSize: Number(configService.get<string>('DB_MAX_POOL_SIZE') || 20),
  minPoolSize: 0,
  maxIdleTimeMS: 60_000,
  serverSelectionTimeoutMS: 10_000,
  socketTimeoutMS: 30_000,
  autoIndex: configService.get<string>('NODE_ENV') !== 'production',
  autoCreate: configService.get<string>('NODE_ENV') !== 'production',
});
