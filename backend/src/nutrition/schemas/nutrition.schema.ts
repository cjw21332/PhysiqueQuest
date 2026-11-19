import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types, type HydratedDocument } from 'mongoose';

export type NutritionDocument = HydratedDocument<Nutrition>;

@Schema({ _id: false })
export class MealEntry {
@Prop({type:Number, min:0}) saturatedFat?: number | null;
@Prop({type:Number, min:0}) transFat?: number | null;
@Prop({type:Number, min:0}) fiber?: number | null;
@Prop({type:Number, min:0}) sugars?: number | null;
@Prop({type:Number, min:0}) addedSugar?: number | null;
@Prop({type:Number, min:0}) sodium?: number | null;
@Prop({type:Number, min:0}) cholesterol?: number | null;
  @Prop({ type: String }) brand?: string;
  @Prop({ type: Number, min: 0 }) servingQuantity?: number;
  @Prop({ type: Number, min: 0 }) servingSizeG?: number;
  @Prop({ type: String }) servingUnit?: string;
  @Prop({ type: String }) barcode?: string;
  @Prop({ required: true }) id: string;
  @Prop({ required: true }) name: string;
  @Prop({ required: true }) meal: string;
  @Prop({ type: Number, default: null, min: 0 }) calories: number | null;
  @Prop({ default: '' }) detail: string;
  @Prop({ default: '' }) time: string;
  @Prop({ default: 'Manual' }) source: string;
  @Prop({ default: false }) edited: boolean;
  @Prop({ type: Number, default: null, min: 0 }) protein: number | null;
  @Prop({ type: Number, default: null, min: 0 }) carbs: number | null;
  @Prop({ type: Number, default: null, min: 0 }) fat: number | null;
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
  @Prop() nutritionProvider?: string;
  @Prop() nutritionDescription?: string;
  @Prop({ type: Object }) nutritionPer100g?: { kcal: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null };
  @Prop({ enum: ['ai', 'manual', 'corrected'] }) identificationMethod?: string;
  @Prop({ type: Boolean }) weightCorrected?: boolean;
  @Prop({ type: Object }) foodEvidence?: { name: string; quantity: string; preparation: string; added_oil: string };
  @Prop({ type: String, maxlength: 120 }) preparation?: string;
  @Prop({ type: String, maxlength: 200 }) addedOil?: string;
  @Prop({ type: Date }) scanSavedAt?: Date;
  @Prop({ type: String }) scanGroupId?: string;
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

  @Prop({ type: [{ _id: false, key: { type: String, required: true }, hash: { type: String, required: true }, mealIds: { type: [String], required: true } }], default: [] })
  scanSaveReceipts?: { key: string; hash: string; mealIds: string[] }[];

  /** Digests of consumed scan identifiers; stored with the meal transaction. */
  @Prop({ type: [String], default: [] })
  consumedScanEvidence?: string[];

  @Prop({ type: Object, default: null })
  dietaryPlan?: { goal: string; calories: number; protein: number; carbs: number; fat: number; activity?: string; startedAt?: string };

  @Prop({ type: Number, default: null, min: 0 })
  previousCalorieTarget?: number | null;

  @Prop({ type: [WaterEntry], default: [] })
  water: WaterEntry[];
}

export const NutritionSchema = SchemaFactory.createForClass(Nutrition);
