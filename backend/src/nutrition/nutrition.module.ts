import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NutritionController } from './nutrition.controller.js';
import { NutritionService } from './nutrition.service.js';
import { Nutrition, NutritionSchema } from './schemas/nutrition.schema.js';

@Module({
  imports: [MongooseModule.forFeature([{ name: Nutrition.name, schema: NutritionSchema }])],
  controllers: [NutritionController],
  providers: [NutritionService],
})
export class NutritionModule {}
