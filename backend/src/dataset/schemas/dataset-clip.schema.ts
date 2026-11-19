import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

export const PATTERNS = [
  'cardio_dynamic',
  'core_flexion',
  'core_isometric',
  'curl',
  'hinge',
  'horizontal_pull',
  'horizontal_push',
  'lateral_raise',
  'squat',
  'triceps_extension',
] as const;

export type Pattern = (typeof PATTERNS)[number];
export type ClipStatus = 'pending_annotation' | 'accepted' | 'rejected';

@Schema({ _id: false })
export class RepBoundary {
  @Prop({ required: true, min: 0 }) startFrame: number;
  @Prop({ required: true, min: 1 }) endFrame: number;
}

@Schema({ _id: false })
export class MovementPhase {
  @Prop({ required: true, maxlength: 40 }) name: string;
  @Prop({ required: true, min: 0 }) startFrame: number;
  @Prop({ required: true, min: 1 }) endFrame: number;
}

/** Human label added after review; never written by the recording client. */
@Schema({ _id: false })
export class ClipAnnotation {
  @Prop({ required: true, maxlength: 80 }) exerciseId: string;
  @Prop({ type: String, required: true, enum: PATTERNS }) pattern: Pattern;
  @Prop({ type: String, required: true, enum: ['correct', 'incorrect', 'mixed', 'unclear'] })
  correctness: 'correct' | 'incorrect' | 'mixed' | 'unclear';
  @Prop({ min: 0 }) movementStartFrame?: number;
  @Prop({ min: 1 }) movementEndFrame?: number;
  @Prop({ type: [RepBoundary], default: [] }) repBoundaries: RepBoundary[];
  @Prop({ type: [MovementPhase], default: [] }) phases: MovementPhase[];
  @Prop({ type: [String], default: [] }) formDeviations: string[];
  @Prop({ type: String, required: true, enum: ['good', 'fair', 'poor'] }) keypointQuality: 'good' | 'fair' | 'poor';
  @Prop({ maxlength: 500 }) notes?: string;
  @Prop({ required: true }) annotatorRef: string;
  @Prop({ required: true }) annotatedAt: Date;
}

@Schema({ timestamps: true, collection: 'dataset_clips' })
export class DatasetClip {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true }) userId: Types.ObjectId;
  @Prop({ required: true, index: true, maxlength: 32 }) subjectPseudonym: string;
  @Prop({ required: true, maxlength: 80 }) exerciseId: string;
  @Prop({ required: true, maxlength: 120 }) exerciseName: string;
  @Prop({ type: String, required: true, enum: PATTERNS }) pattern: Pattern;
  @Prop({ type: String, required: true, enum: ['front', 'side', 'diagonal', 'other'] }) cameraPlacement: 'front' | 'side' | 'diagonal' | 'other';
  @Prop({ type: String, required: true, enum: ['front', 'back'] }) cameraFacing: 'front' | 'back';
  @Prop({ type: String, required: true, enum: ['portrait', 'landscape'] }) orientation: 'portrait' | 'landscape';
  @Prop({ required: true, min: 0 }) durationSeconds: number;
  @Prop({ required: true, min: 1 }) frameCount: number;
  @Prop({ required: true, min: 0, max: 1 }) detectionRate: number;
  @Prop({ required: true }) medianFrameIntervalMs: number;
  @Prop({ required: true, maxlength: 40 }) appVersion: string;
  @Prop({ required: true, maxlength: 40 }) consentVersion: string;
  @Prop({ type: [RepBoundary], default: [] }) repBoundaries: RepBoundary[];
  @Prop({ min: 0 }) declaredReps?: number;
  @Prop({ required: true, length: 64, unique: true }) payloadSha256: string;
  @Prop({ required: true, min: 1 }) payloadBytes: number;
  @Prop({
    required: true,
    type: String,
    enum: ['pending_annotation', 'accepted', 'rejected'],
    default: 'pending_annotation',
    index: true,
  })
  status: ClipStatus;
  @Prop({ type: ClipAnnotation, default: null }) annotation: ClipAnnotation | null;
  @Prop({ type: [String], default: [] }) qualityFlags: string[];
}

export const DatasetClipSchema = SchemaFactory.createForClass(DatasetClip);
DatasetClipSchema.index({ status: 1, createdAt: 1 });
DatasetClipSchema.index({ subjectPseudonym: 1, createdAt: -1 });

/**
 * Keypoint payloads are stored separately so clip listings and annotation
 * queues never load megabytes of coordinates. Compressed at rest.
 */
@Schema({ timestamps: true, collection: 'dataset_clip_payloads' })
export class DatasetClipPayload {
  @Prop({ type: Types.ObjectId, ref: 'DatasetClip', required: true, unique: true }) clipId: Types.ObjectId;
  @Prop({ required: true }) data: Buffer;
  @Prop({ required: true, length: 64 }) sha256: string;
}

export const DatasetClipPayloadSchema = SchemaFactory.createForClass(DatasetClipPayload);
