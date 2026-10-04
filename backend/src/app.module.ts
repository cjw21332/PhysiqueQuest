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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
