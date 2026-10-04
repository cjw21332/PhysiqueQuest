import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ExerciseDocument = Exercise & Document;

@Schema({ timestamps: true })
export class Exercise {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ required: true })
  targetMuscle: string;

  @Prop({ required: true })
  equipment: string;

  @Prop({ required: true })
  difficulty: string;

  @Prop({ required: false })
  pictureUrl?: string;

  @Prop({ required: false })
  videoUrl?: string;

  @Prop({ type: [String], required: true })
  instructions: string[];

  @Prop({ default: 'Manual' })
  trackingStatus: string;
}

export const ExerciseSchema = SchemaFactory.createForClass(Exercise);
