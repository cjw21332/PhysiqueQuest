import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AccountLifecycleFence } from '../privacy/account-lifecycle-fence.js';
import { MAX_SAVED_PROGRAMS, SavedProgram, savedProgramSchema } from './saved-program.schema.js';

/** User-built and saved template programs, synced to the account. */
@Injectable()
export class SavedProgramsService {
  constructor(@InjectModel(SavedProgram.name) private readonly model: Model<SavedProgram>) {}

  async list(userId: string) {
    if (!Types.ObjectId.isValid(userId)) throw new NotFoundException('Profile not found');
    const rows = await this.model.find({ userId: new Types.ObjectId(userId) }).sort({ updatedAt: -1 }).limit(MAX_SAVED_PROGRAMS).lean().exec();
    return { items: rows.map(row => ({ ...row.program, updatedAt: row.updatedAt?.toISOString() })) };
  }

  async save(userId: string, programId: string, body: unknown) {
    const parsed = savedProgramSchema.safeParse(body);
    if (!parsed.success || parsed.data.id !== programId) throw new BadRequestException('Check the program name, days and exercises, then try again.');
    const owner = new Types.ObjectId(userId);
    const fence = new AccountLifecycleFence(this.model.db), generation = await fence.generation(userId);
    const exists = await this.model.exists({ userId: owner, programId }).exec();
    if (!exists && await this.model.countDocuments({ userId: owner }).exec() >= MAX_SAVED_PROGRAMS) throw new ConflictException(`You can keep up to ${MAX_SAVED_PROGRAMS} programs. Delete one to save another.`);
    await fence.withActiveWrite(userId, async session => this.model.findOneAndUpdate({ userId: owner, programId }, { $set: { program: parsed.data }, $setOnInsert: { userId: owner, programId } }, { upsert: true, new: true, runValidators: true, session }).exec(), generation);
    return this.list(userId);
  }

  async remove(userId: string, programId: string) {
    const fence = new AccountLifecycleFence(this.model.db), generation = await fence.generation(userId);
    await fence.withActiveWrite(userId, async session => this.model.deleteOne({ userId: new Types.ObjectId(userId), programId }, { session }).exec(), generation);
    return this.list(userId);
  }
}
