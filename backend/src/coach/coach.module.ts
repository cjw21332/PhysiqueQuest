import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Profile, ProfileSchema } from '../profile/schemas/profile.schema.js';
import { Settings, SettingsSchema } from '../settings/schemas/settings.schema.js';
import { ExerciseDbModule } from '../exercises/exercisedb.module.js';
import { CoachController } from './coach.controller.js';
import { CoachService } from './coach.service.js';
import { CoachProgram, CoachProgramSchema } from './coach-program.schema.js';

@Module({
  imports: [
    ExerciseDbModule,
    MongooseModule.forFeature([
      { name: Profile.name, schema: ProfileSchema },
      { name: Settings.name, schema: SettingsSchema },
      { name: CoachProgram.name, schema: CoachProgramSchema },
    ]),
  ],
  controllers: [CoachController],
  providers: [CoachService],
})
export class CoachModule {}
