import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateProgressDto } from './dto/progress.dto.js';
import { ProgressEntry } from './schemas/progress-entry.schema.js';

@Injectable()
export class ProgressService {
  constructor(@InjectModel(ProgressEntry.name) private readonly model: Model<ProgressEntry>) {}
  async add(userId: string, dto: CreateProgressDto) {
    if (!Number.isFinite(dto.value) || dto.value < 0.1 || dto.value > 1000) throw new BadRequestException('Measurement value is outside the allowed range');
    const allowed = dto.metric === 'waist' ? ['cm', 'in'] : ['kg', 'lb'];
    if (!allowed.includes(dto.unit)) throw new BadRequestException('Unit is not valid for this metric');
    const measuredAt = new Date(dto.measuredAt);
    if (!Number.isFinite(measuredAt.getTime())) throw new BadRequestException('Measurement date is invalid');
    if (measuredAt.getTime() > Date.now() + 60_000) throw new BadRequestException('Measurement date cannot be in the future');
    return this.model.create({ userId: new Types.ObjectId(userId), metric: dto.metric, value: dto.value, unit: dto.unit, measuredAt });
  }
  async list(userId: string, metric: string, limit = 90) {
    if (typeof metric !== 'string' || (metric && !['weight', 'waist', 'benchPress'].includes(metric))) throw new BadRequestException('Invalid measurement metric');
    const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
    if (metric) filter.metric = metric;
    return this.model.find(filter).sort({ measuredAt: -1 }).limit(Math.min(Math.max(limit, 1), 365));
  }
  async remove(userId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Measurement not found');
    const deleted = await this.model.findOneAndDelete({ _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) });
    if (!deleted) throw new NotFoundException('Measurement not found');
    return deleted;
  }
}
