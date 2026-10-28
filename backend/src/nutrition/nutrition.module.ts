import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NutritionController } from './nutrition.controller.js';
import { NutritionService } from './nutrition.service.js';
import { Nutrition, NutritionSchema } from './schemas/nutrition.schema.js';
import { Profile, ProfileSchema } from '../profile/schemas/profile.schema.js';
import { DietaryRecommendationService } from './dietary-recommendation.service.js';
import { CoachRateLimitGuard } from '../coach/coach-rate-limit.guard.js';

@Module({
  imports: [MongooseModule.forFeature([{ name: Nutrition.name, schema: NutritionSchema }, { name: Profile.name, schema: ProfileSchema }])],
  controllers: [NutritionController],
  providers: [NutritionService, DietaryRecommendationService, CoachRateLimitGuard],
  exports: [NutritionService],
})
export class NutritionModule {}
