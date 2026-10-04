import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProgressController } from './progress.controller.js';
import { ProgressService } from './progress.service.js';
import { ProgressEntry, ProgressEntrySchema } from './schemas/progress-entry.schema.js';
@Module({ imports: [MongooseModule.forFeature([{ name: ProgressEntry.name, schema: ProgressEntrySchema }])], controllers: [ProgressController], providers: [ProgressService], exports: [ProgressService] })
export class ProgressModule {}
