import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'dataset_consents' })
export class DatasetConsent {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;
  @Prop({ required: true, maxlength: 40 }) consentVersion: string;
  @Prop({ required: true, length: 64 }) consentTextHash: string;
  @Prop({ required: true, minlength: 16, maxlength: 32, index: true }) subjectPseudonym: string;
  @Prop({ type: Date, required: true }) acceptedAt: Date;
  @Prop({ type: Date, default: null }) withdrawnAt: Date | null;
}

export const DatasetConsentSchema = SchemaFactory.createForClass(DatasetConsent);
