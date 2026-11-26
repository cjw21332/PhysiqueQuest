import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongoSchema, Types } from 'mongoose';
import { z } from 'zod';

const exercise = z.object({
  exerciseId: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  targetMuscle: z.string().max(120),
  equipment: z.string().max(120),
  sets: z.number().int().min(1).max(10),
  reps: z.string().trim().max(20).optional(),
  weight: z.number().min(0).max(1000).optional(),
  unit: z.enum(['kg', 'lbs']),
  restSets: z.number().int().min(0).max(600),
  restNext: z.number().int().min(0).max(600),
}).strict();
const day = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  title: z.string().trim().min(1).max(60),
  weekday: z.number().int().min(0).max(6).optional(),
  exercises: z.array(exercise).max(100),
}).strict();
export const savedProgramSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  name: z.string().trim().min(1).max(60),
  notes: z.string().trim().max(500).optional(),
  source: z.enum(['custom', 'split', 'athlete']),
  templateId: z.string().max(64).optional(),
  days: z.array(day).min(1).max(7),
}).strict().refine(value => value.days.some(item => item.exercises.length > 0), 'Add at least one exercise.');
export type SavedProgramInput = z.infer<typeof savedProgramSchema>;
export const MAX_SAVED_PROGRAMS = 30;

@Schema({ timestamps: true, collection: 'saved_programs' })
export class SavedProgram {
  @Prop({ type: MongoSchema.Types.ObjectId, required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  programId: string;

  @Prop({ type: MongoSchema.Types.Mixed, required: true })
  program: SavedProgramInput;

  updatedAt?: Date;
}
export const SavedProgramSchema = SchemaFactory.createForClass(SavedProgram);
SavedProgramSchema.index({ userId: 1, programId: 1 }, { unique: true });
