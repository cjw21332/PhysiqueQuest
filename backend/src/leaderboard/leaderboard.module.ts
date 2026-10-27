import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../auth/schemas/user.schema.js';
import { Settings, SettingsSchema } from '../settings/schemas/settings.schema.js';
import { Nutrition, NutritionSchema } from '../nutrition/schemas/nutrition.schema.js';
import { WorkoutSession, WorkoutSessionSchema } from '../workouts/schemas/workout-session.schema.js';
import { LeaderboardSnapshot, LeaderboardSnapshotSchema } from './schemas/leaderboard-snapshot.schema.js';
import { LeaderboardController } from './leaderboard.controller.js';
import { LeaderboardService } from './leaderboard.service.js';
import { StrengthService } from './strength.service.js';
import { Profile, ProfileSchema } from '../profile/schemas/profile.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LeaderboardSnapshot.name, schema: LeaderboardSnapshotSchema },
      { name: User.name, schema: UserSchema },
      { name: Settings.name, schema: SettingsSchema },
      { name: Nutrition.name, schema: NutritionSchema },
      { name: WorkoutSession.name, schema: WorkoutSessionSchema },
      { name: Profile.name, schema: ProfileSchema },
    ]),
  ],
  controllers: [LeaderboardController],
  providers: [LeaderboardService, StrengthService],
  exports: [LeaderboardService],
})
export class LeaderboardModule {}
