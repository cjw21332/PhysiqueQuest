import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Profile, ProfileSchema } from '../profile/schemas/profile.schema.js';
import { Settings, SettingsSchema } from '../settings/schemas/settings.schema.js';
import { ExerciseDbModule } from '../exercises/exercisedb.module.js';
import { CoachController } from './coach.controller.js';
import { FeedbackModule } from '../feedback/feedback.module.js';
import { CoachService } from './coach.service.js';
import { CoachProgram, CoachProgramSchema } from './coach-program.schema.js';
import { SavedProgram, SavedProgramSchema } from './saved-program.schema.js';
import { SavedProgramsService } from './saved-programs.service.js';
import { AiRateLimitGuard } from '../common/ai-rate-limit.guard.js';

@Module({
  imports: [
    ExerciseDbModule,
    FeedbackModule,
    MongooseModule.forFeature([
      { name: Profile.name, schema: ProfileSchema },
      { name: Settings.name, schema: SettingsSchema },
      { name: CoachProgram.name, schema: CoachProgramSchema },
      { name: SavedProgram.name, schema: SavedProgramSchema },
    ]),
  ],
  controllers: [CoachController],
  providers: [CoachService, SavedProgramsService, AiRateLimitGuard],
  exports: [CoachService],
})
export class CoachModule {}
