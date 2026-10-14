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
  @Prop({ default: false }) edited: boolean;
  @Prop({ default: 0, min: 0 }) protein: number;
  @Prop({ default: 0, min: 0 }) carbs: number;
  @Prop({ default: 0, min: 0 }) fat: number;
  @Prop({ required: true }) date: string;

  // Provenance for meals written by POST /api/nutrition/meals/from-scan. All
  // optional, so documents written before scanning existed stay valid and no
  // migration is required.
  /** USDA FoodData Central identifier, when the item matched a record. */
  @Prop({ min: 1 }) fdcId?: number;
  /** Vision model confidence in the identification, 0 to 1. */
  @Prop({ min: 0, max: 1 }) confidence?: number;
  /** Estimated edible weight the macros were scaled to, in grams. */
  @Prop({ min: 0 }) estWeightG?: number;
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
