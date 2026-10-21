import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ExerciseLibraryService } from './exercise-library.service.js';
import { parseCatalogQuery } from './catalog-query.js';

@Controller('exercises')
@UseGuards(JwtAuthGuard)
export class ExerciseLibraryController {
  constructor(private readonly service: ExerciseLibraryService) {}

  @Get()
  findAll(@Query() q: { search?: string; muscle?: string; equipment?: string; page?: string; limit?: string }) {
    return this.service.findAll(parseCatalogQuery(q));
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.service.findBySlug(slug);
  }
}
