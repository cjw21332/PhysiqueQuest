import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';

/**
 * A point-in-time capture of one user's standing for a leaderboard period.
 *
 * Movement (↑2 / ↓1) is derived by diffing the latest standing against the
 * most recent snapshot captured for an earlier boundary of the same period.
 */
@Schema({ timestamps: true, collection: 'leaderboard_snapshots' })
export class LeaderboardSnapshot {
  @Prop({ required: true })
  period: string;

  @Prop({ required: true })
  boundaryKey: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  subjectId: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  rank: number;

  @Prop({ required: true, min: 0 })
  points: number;
}

export const LeaderboardSnapshotSchema = SchemaFactory.createForClass(LeaderboardSnapshot);
LeaderboardSnapshotSchema.index({ period: 1, boundaryKey: 1 });
LeaderboardSnapshotSchema.index({ period: 1, boundaryKey: 1, subjectId: 1 }, { unique: true });
