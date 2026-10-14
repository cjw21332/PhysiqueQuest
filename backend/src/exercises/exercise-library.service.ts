import { Injectable } from '@nestjs/common';
import { CatalogQuery, ExerciseDbService } from './exercisedb.service.js';
@Injectable()
export class ExerciseLibraryService {
  constructor(private readonly catalog: ExerciseDbService) {}
  findAll(query: CatalogQuery) { return this.catalog.findAll(query); }
  findBySlug(slug: string) { return this.catalog.findBySlug(slug.trim()); }
  async findBestMatch(name: string, targetMuscle?: string) {
    return (await this.catalog.findAll({ search: name, muscle: targetMuscle, limit: 1 })).items[0] ?? null;
  }
}
