import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types, type HydratedDocument } from 'mongoose';

export type ProfileDocument = HydratedDocument<Profile>;

@Schema({ timestamps: true, collection: 'profiles' })
export class Profile {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  // Personal Data (Step 1)
  @Prop({ required: true })
  age: string;

  @Prop({ required: true })
  height: string;

  @Prop()
  heightInches?: string;

  @Prop({ required: true, enum: ['cm', 'ft & in.'] })
  heightUnit: string;

  @Prop({ required: true })
  weight: string;

  @Prop({ required: true, enum: ['kg', 'lbs'] })
  weightUnit: string;

  @Prop({ required: true })
  gender: string;

  @Prop()
  chest?: string;

  @Prop()
  waist?: string;

  @Prop()
  arms?: string;

  @Prop({ enum: ['cm', 'inch'] })
  measurementUnit?: string;

  @Prop({ required: true })
  activity: string;

  // Goals (Step 2)
  @Prop({ required: true })
  goal: string;

  @Prop()
  targetWeight?: string;

  @Prop()
  targetDate?: string;

  @Prop({ required: true })
  seriousness: string;

  // Training Preference (Step 3)
  @Prop({ type: [String], required: true })
  equipment: string[];

  @Prop({ type: [String], required: true })
  days: string[];

  @Prop({ required: true })
  duration: string;

  // Health & Safety (Step 4)
  @Prop({ type: [String], default: [] })
  conditions: string[];

  @Prop({ default: '' })
  healthNotes: string;

  @Prop({ required: true })
  contactName: string;

  @Prop({ required: true })
  contactPhone: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const ProfileSchema = SchemaFactory.createForClass(Profile);

// Indexes for efficient queries
