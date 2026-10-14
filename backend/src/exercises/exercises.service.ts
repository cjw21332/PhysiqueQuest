import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ExerciseDto } from './dto/exercise.dto.js';
import { ExerciseRecord } from './schemas/exercise.schema.js';

@Injectable()
export class AdminExercisesService {
  constructor(@InjectModel(ExerciseRecord.name) private readonly model: Model<ExerciseRecord>) {}
  async list(limit = 100) { return this.model.find({}).sort({ createdAt: -1 }).limit(Math.min(Math.max(limit, 1), 100)); }
  async create(dto: ExerciseDto) { return this.model.create({ ...dto, group: dto.group || 'General', status: dto.status || 'draft', pose: dto.pose || 'missing' }); }
  async update(id: string, dto: ExerciseDto) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Exercise not found');
    const updated = await this.model.findOneAndUpdate({ _id: new Types.ObjectId(id) }, { $set: dto }, { returnDocument: 'after', runValidators: true });
    if (!updated) throw new NotFoundException('Exercise not found');
    return updated;
  }
  async remove(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Exercise not found');
    const deleted = await this.model.findOneAndDelete({ _id: new Types.ObjectId(id) });
    if (!deleted) throw new NotFoundException('Exercise not found');
    return deleted;
  }
}
