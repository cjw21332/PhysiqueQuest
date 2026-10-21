import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types, type HydratedDocument } from 'mongoose';
import { HEALTH_FIELDS, decryptProfile, transformProfile } from '../../privacy/health-encryption.js';

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
  chestUnit?: string;

  @Prop({ enum: ['cm', 'inch'] })
  waistUnit?: string;

  @Prop({ enum: ['cm', 'inch'] })
  armsUnit?: string;

  // Legacy shared unit retained for profiles created before per-measurement units.
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
  contactRelationship?: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const ProfileSchema = SchemaFactory.createForClass(Profile);

ProfileSchema.pre('save', function () {
  const fields = HEALTH_FIELDS.filter(field => this.isNew || this.isModified(field));
  const patch: Record<string, unknown> = { userId: this.userId };
  for (const field of fields) patch[field] = this.get(field);
  transformProfile(patch, true);
  for (const field of fields) this.set(field, patch[field]);
});
ProfileSchema.pre('insertMany', function (documents: Record<string, unknown>[]) {
  for (const profile of documents) transformProfile(profile, true);
});
ProfileSchema.post('insertMany', function (documents: unknown) { if (Array.isArray(documents)) for (const profile of documents) decryptProfile(profile); });
ProfileSchema.pre('bulkWrite', function () { throw new Error('Use individual profile writes for owner-bound encryption'); });
ProfileSchema.post('save', function (profile) { decryptProfile(profile); });
ProfileSchema.post(['find', 'findOne', 'findOneAndUpdate'], function (result) {
  for (const profile of Array.isArray(result) ? result : result ? [result] : []) decryptProfile(profile);
});
ProfileSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany', 'replaceOne'], async function () {
  const update = this.getUpdate();
  if (!update) return;
  // Per-owner authenticated encryption cannot safely operate on multi-owner or pipeline writes.
  if (Array.isArray(update)) throw new Error('Unsupported profile update');
  for (const [operator, patch] of Object.entries(update)) {
    if (!operator.startsWith('$') || typeof patch !== 'object' || !patch) continue;
    if (Object.keys(patch).some(path => HEALTH_FIELDS.some(field => path === field || path.startsWith(`${field}.`))) &&
      (!['$set', '$setOnInsert'].includes(operator) || Object.keys(patch).some(path => path.includes('.')))) throw new Error('Unsupported profile update');
  }
  const patches = Object.keys(update).some(key => key.startsWith('$')) ? [update.$set, update.$setOnInsert].filter((value): value is NonNullable<typeof value> => Boolean(value)) : [update];
  if (!patches.some(values => HEALTH_FIELDS.some(field => values[field] !== undefined))) return;
  if ((this as unknown as { op: string }).op === 'updateMany') throw new Error('Unsupported profile update');
  const owner = this.getQuery().userId ?? (await this.model.collection.findOne(this.getQuery(), { projection: { userId: 1 } }))?.userId;
  for (const values of patches) {
    const encrypted: Record<string, unknown> = transformProfile({ ...values, userId: owner }, true);
    for (const field of HEALTH_FIELDS) if (values[field] !== undefined) values[field] = encrypted[field];
  }
});

// Indexes for efficient queries
