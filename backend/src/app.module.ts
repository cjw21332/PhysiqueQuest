import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { ProfileModule } from './profile/profile.module.js';
import { getDatabaseConfig } from './config/database.config.js';
import { NutritionModule } from './nutrition/nutrition.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { ActivityModule } from './activity/activity.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { FoodScanModule } from './foodscan/foodscan.module.js';
import { WorkoutsModule } from './workouts/workouts.module.js';
import { ProgressModule } from './progress/progress.module.js';
import { LeaderboardModule } from './leaderboard/leaderboard.module.js';
import { CoachModule } from './coach/coach.module.js';
import { ExerciseLibraryModule } from './exercises/exercise-library.module.js';
import { ExercisesModule } from './exercises/exercises.module.js';
import { SafetyModule } from './safety/safety.module.js';
import { PoseModule } from './pose/pose.module.js';
import { AdminModule } from './admin/admin.module.js';
import { validateEnvironment } from './config/environment.js';
import { HealthController } from './health.controller.js';
import { PrivacyModule } from './privacy/privacy.module.js';
import { PushModule } from './push/push.module.js';
import { StorageModule } from './storage/storage.module.js';
import { SyncModule } from './sync/sync.module.js';
import { AnalysisJobsModule } from './jobs/analysis-jobs.module.js';
import { ChatModule } from './chat/chat.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnvironment,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: getDatabaseConfig,
      inject: [ConfigService],
    }),
    AuthModule,
    ProfileModule,
    NutritionModule,
    SettingsModule,
    ActivityModule,
    NotificationsModule,
    FoodScanModule,
    WorkoutsModule,
    ProgressModule,
    LeaderboardModule,
    CoachModule,
    ExerciseLibraryModule,
    ExercisesModule,
    SafetyModule,
    PoseModule,
    AdminModule,
    PrivacyModule,
    PushModule,
    StorageModule,
    SyncModule,
    AnalysisJobsModule,
    ChatModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
