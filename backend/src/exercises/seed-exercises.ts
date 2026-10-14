import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { AppModule } from '../app.module.js';
import { seedCatalog, starterCatalog } from './catalog.js';

const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
try {
  await seedCatalog(app.get(getModelToken('ExerciseRecord')));
  console.log(`Imported ${starterCatalog.length} catalog entries; existing records were preserved.`);
} finally { await app.close(); }
