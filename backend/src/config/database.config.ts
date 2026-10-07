import { ConfigService } from '@nestjs/config';
import { MongooseModuleOptions } from '@nestjs/mongoose';

export const getDatabaseConfig = (
  configService: ConfigService,
): MongooseModuleOptions => ({
  uri: configService.getOrThrow<string>('MONGODB_URI'),
  retryAttempts: 5,
  retryDelay: 3000,
});
