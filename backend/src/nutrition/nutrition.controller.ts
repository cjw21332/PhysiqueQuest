import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { DietaryPlanDto, MealDto, MealFromScanDto, WaterDto } from './dto/nutrition.dto.js';
import { NutritionService } from './nutrition.service.js';
import { DietaryRecommendationService } from './dietary-recommendation.service.js';
import { CoachRateLimitGuard } from '../coach/coach-rate-limit.guard.js';

type AuthenticatedRequest = Request & { user: { userId: string } };

@Controller('nutrition')
@UseGuards(JwtAuthGuard)
export class NutritionController {
  constructor(private readonly service: NutritionService, private readonly recommendations: DietaryRecommendationService) {}

  @Get() get(@Req() req: AuthenticatedRequest) { return this.service.read(req.user.userId); }
  @Put('plan') setPlan(@Req() req: AuthenticatedRequest, @Body() dto: DietaryPlanDto) { return this.service.setPlan(req.user.userId, dto); }
  @Post('plan/recommend') @UseGuards(CoachRateLimitGuard) recommend(@Req() req: AuthenticatedRequest) { return this.recommendations.recommend(req.user.userId); }
  @Post('meals') addMeal(@Req() req: AuthenticatedRequest, @Body() dto: MealDto) { return this.service.addMeal(req.user.userId, dto); }
  /** Turns a POST /api/nutrition/scan result into one meal row per priced item. */
  @Post('meals/from-scan') addMealsFromScan(@Req() req: AuthenticatedRequest, @Body() dto: MealFromScanDto) { return this.service.addMealsFromScan(req.user.userId, dto); }
  @Put('meals/:id') updateMeal(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: MealDto) { return this.service.updateMeal(req.user.userId, id, dto); }
  @Delete('meals/:id') deleteMeal(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.service.deleteMeal(req.user.userId, id); }
  @Get('water') getWater(@Req() req: AuthenticatedRequest) { return this.service.read(req.user.userId).then(state => state.water); }
  @Put('water') setWater(@Req() req: AuthenticatedRequest, @Body() dto: WaterDto) { return this.service.setWater(req.user.userId, dto); }
}
