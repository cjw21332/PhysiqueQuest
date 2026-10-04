import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ExerciseRecord } from './schemas/exercise.schema.js';

@Injectable()
export class ExerciseLibraryService {
  constructor(@InjectModel(ExerciseRecord.name) private readonly model: Model<ExerciseRecord>) {}

  async findAll(query: { search?: string; muscle?: string; equipment?: string; page?: number; limit?: number }) {
    const filter: Record<string, unknown> = { status: 'published', pose: { $in: ['ready', 'training'] } };
    if (query.search && String(query.search).trim()) filter.name = { $regex: String(query.search).trim(), $options: 'i' };
    if (query.muscle && String(query.muscle) !== 'All' && String(query.muscle).trim()) filter.targetMuscle = { $regex: '^' + String(query.muscle).trim() + '$', $options: 'i' };
    if (query.equipment && String(query.equipment) !== 'Any equipment' && String(query.equipment).trim()) filter.equipment = { $regex: '^' + String(query.equipment).trim() + '$', $options: 'i' };
    console.log('MongoDB filter:', JSON.stringify(filter));
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(500, Math.max(1, query.limit ?? 100));
    const docs = await this.model.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
    const total = await this.model.countDocuments(filter);
    return { items: docs, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findBySlug(slug: string) {
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
