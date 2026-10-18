import { Controller, Get, Query, Param } from '@nestjs/common';
import { ExerciseLibraryService } from './exercise-library.service.js';

@Controller('exercises')
// Public provider/curated guides only. User programs and admin records have separate guarded controllers.
export class ExerciseLibraryController {
  constructor(private readonly service: ExerciseLibraryService) {}

  @Get()
  findAll(@Query() q: { source?: string; search?: string; muscle?: string; equipment?: string; page?: string; limit?: string }) {
    return this.service.findAll({
      search: q.search,
      source: q.source,
      muscle: q.muscle,
      equipment: q.equipment,
      page: q.page ? parseInt(q.page, 10) : 1,
      limit: q.limit ? parseInt(q.limit, 10) : 12,
    });
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.service.findBySlug(slug);
  }
}
