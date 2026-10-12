import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Profile, ProfileSchema } from '../profile/schemas/profile.schema.js';
import { Settings, SettingsSchema } from '../settings/schemas/settings.schema.js';
import { ExerciseRecord, ExerciseRecordSchema } from '../exercises/schemas/exercise.schema.js';
import { CoachController } from './coach.controller.js';
import { CoachService } from './coach.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Profile.name, schema: ProfileSchema },
      { name: Settings.name, schema: SettingsSchema },
      { name: ExerciseRecord.name, schema: ExerciseRecordSchema },
    ]),
  ],
  controllers: [CoachController],
  providers: [CoachService],
})
export class CoachModule {}
