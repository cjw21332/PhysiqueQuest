import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SettingsController } from './settings.controller.js';
import { SettingsService } from './settings.service.js';
import { Settings, SettingsSchema } from './schemas/settings.schema.js';

@Module({
  imports: [MongooseModule.forFeature([{ name: Settings.name, schema: SettingsSchema }])],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
