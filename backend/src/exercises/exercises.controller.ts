import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { ExerciseDto } from './dto/exercise.dto.js';
import { AdminExercisesService } from './exercises.service.js';

@Controller('admin/exercises')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminExercisesController {
  constructor(private readonly service: AdminExercisesService) {}
  @Get() list(@Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number) { return this.service.list(limit); }
  @Post() create(@Body() dto: ExerciseDto) { return this.service.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: ExerciseDto) { return this.service.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}
