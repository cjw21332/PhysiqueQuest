import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Profile, ProfileSchema } from '../profile/schemas/profile.schema.js';
import { Nutrition, NutritionSchema } from '../nutrition/schemas/nutrition.schema.js';
import { WorkoutSession, WorkoutSessionSchema } from '../workouts/schemas/workout-session.schema.js';
import { CoachRateLimitGuard } from '../coach/coach-rate-limit.guard.js';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';
import { ActivityModule } from '../activity/activity.module.js';
import { CoachModule } from '../coach/coach.module.js';
import { ProgressModule } from '../progress/progress.module.js';
import { LeaderboardModule } from '../leaderboard/leaderboard.module.js';

@Module({ imports: [MongooseModule.forFeature([{ name: Profile.name, schema: ProfileSchema }, { name: Nutrition.name, schema: NutritionSchema }, { name: WorkoutSession.name, schema: WorkoutSessionSchema }]), ActivityModule, CoachModule, ProgressModule, LeaderboardModule], controllers: [ChatController], providers: [ChatService, CoachRateLimitGuard] })
export class ChatModule {}
