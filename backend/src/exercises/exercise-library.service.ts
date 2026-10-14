import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ExerciseRecord } from './schemas/exercise.schema.js';
import { WgerService } from './wger.service.js';

@Injectable()
export class ExerciseLibraryService {
  constructor(@InjectModel(ExerciseRecord.name) private readonly model: Model<ExerciseRecord>, private readonly wger: WgerService) {}

  async findAll(query: { search?: string; muscle?: string; equipment?: string; page?: number; limit?: number }) {
    const catalog = await this.wger.catalog();
    const search = String(query.search ?? '').trim().toLowerCase();
    const muscle = String(query.muscle ?? '').trim().toLowerCase();
    const rawEquipment = String(query.equipment ?? '').trim().toLowerCase();
    const equipment = rawEquipment === 'dumbbells' ? 'dumbbell' : rawEquipment;
    const filtered = catalog.filter(item =>
      (!search || item.name.toLowerCase().includes(search)) &&
      (!muscle || muscle === 'all' || item.targetMuscle.toLowerCase() === muscle) &&
      (!equipment || ['all', 'any equipment'].includes(equipment) ||
        (equipment === 'full gym' ? item.equipmentList.some(name => name !== 'Bodyweight') : item.equipmentList.some(name => name.toLowerCase() === equipment))),
    );
    const page = Number.isFinite(query.page) ? Math.max(1, Math.floor(query.page!)) : 1;
    const limit = Number.isFinite(query.limit) ? Math.min(500, Math.max(1, Math.floor(query.limit!))) : 100;
    return { items: filtered.slice((page - 1) * limit, page * limit), total: filtered.length, page, limit, pages: Math.ceil(filtered.length / limit), source: 'wger' };
  }

  async findBySlug(slug: string) {
    if (/^wger-\d+$/.test(slug)) {
      const item = (await this.wger.catalog()).find(exercise => exercise.slug === slug);
      if (!item) throw new NotFoundException('Exercise not found');
      return item;
    }
    const doc = await this.model.findOne({ slug: slug.trim(), status: { $ne: 'draft' } }).lean();
    if (!doc) throw new NotFoundException('Exercise not found');
    return doc;
  }

  async findBestMatch(aiExerciseName: string, targetMuscle?: string): Promise<ExerciseRecord | null> {
    const clean = (aiExerciseName || '').toLowerCase().trim();
    if (!clean) return null;
    const nameMatch = await this.model.findOne({
      name: { $regex: clean.substring(0, 20), $options: 'i' },
      status: 'published',
    }).lean();
    if (nameMatch) return nameMatch as ExerciseRecord;
    if (targetMuscle) {
      const def = await this.model.findOne({ targetMuscle, status: 'published', name: { $in: ['Barbell Bench Press', 'Dumbbell Bench Press', 'Push-Up'] } }).lean();
      if (def) return def as ExerciseRecord;
      const muscle = await this.model.findOne({ targetMuscle, status: 'published' }).lean();
      if (muscle) return muscle as ExerciseRecord;
    }
    return null;
  }
}
