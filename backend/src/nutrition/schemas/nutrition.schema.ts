import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types, type HydratedDocument } from 'mongoose';

export type NutritionDocument = HydratedDocument<Nutrition>;

@Schema({ _id: false })
export class MealEntry {
  @Prop({ required: true }) id: string;
  @Prop({ required: true }) name: string;
  @Prop({ required: true }) meal: string;
  @Prop({ required: true, min: 0 }) calories: number;
  @Prop({ default: '' }) detail: string;
  @Prop({ default: '' }) time: string;
  @Prop({ default: 'Manual' }) source: string;
  @Prop({ default: 0, min: 0 }) protein: number;
  @Prop({ default: 0, min: 0 }) carbs: number;
  @Prop({ default: 0, min: 0 }) fat: number;
  @Prop({ required: true }) date: string;
}

@Schema({ _id: false })
export class WaterEntry {
  @Prop({ required: true }) date: string;
  @Prop({ required: true, min: 0 }) glasses: number;
}

@Schema({ timestamps: true, collection: 'nutrition' })
export class Nutrition {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({ type: [MealEntry], default: [] })
  meals: MealEntry[];

  @Prop({ type: [WaterEntry], default: [] })
  water: WaterEntry[];
}

export const NutritionSchema = SchemaFactory.createForClass(Nutrition);
