import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types, type Model } from 'mongoose';
import { gzipSync, gunzipSync } from 'node:zlib';
import { AccountLifecycleFence } from '../privacy/account-lifecycle-fence.js';
import { CONSENT_TEXT, CONSENT_VERSION, consentTextHash, pseudonymize } from './dataset-consent.js';
import { payloadHash, validatePayload, type DatasetPayload } from './dataset-payload.js';
import type { AcceptDatasetConsentDto, AnnotateDatasetClipDto, SubmitDatasetClipDto } from './dto/dataset.dto.js';
import {
  DatasetClip,
  DatasetClipPayload,
  type ClipAnnotation,
  type ClipStatus,
  type Pattern,
} from './schemas/dataset-clip.schema.js';
import { DatasetConsent } from './schemas/dataset-consent.schema.js';

export const PAYLOAD_VERSION = 'feature-spec-1.1';

type ConsentState = {
  contributable: boolean;
  reason?: 'not_accepted' | 'outdated_version' | 'withdrawn';
  version: string;
  acceptedAt?: Date;
  subjectPseudonym?: string;
};

@Injectable()
export class DatasetService {
  private readonly logger = new Logger(DatasetService.name);

  constructor(
    @InjectModel(DatasetConsent.name) private readonly consents: Model<DatasetConsent>,
    @InjectModel(DatasetClip.name) private readonly clips: Model<DatasetClip>,
    @InjectModel(DatasetClipPayload.name) private readonly payloads: Model<DatasetClipPayload>,
  ) {}

  private secret(): string {
    const secret = process.env.DATASET_PSEUDONYM_SECRET;
    if (!secret || secret.length < 16) {
      throw new ForbiddenException({ code: 'DATASET_NOT_CONFIGURED', message: 'Dataset contributions are not enabled on this server.' });
    }
    return secret;
  }

  private subject(userId: string): string {
    return pseudonymize(userId, this.secret());
  }

  /** Owner writes must not land on an account that is being deleted. */
  private fence() {
    return new AccountLifecycleFence(this.clips.db);
  }

  consentDocument() {
    return { version: CONSENT_VERSION, text: CONSENT_TEXT, textHash: consentTextHash() };
  }

  async state(userId: string): Promise<ConsentState> {
    const record = await this.consents.findOne({ userId: new Types.ObjectId(userId) }).lean();
    if (!record) return { contributable: false, reason: 'not_accepted', version: CONSENT_VERSION };
    if (record.withdrawnAt) {
      return { contributable: false, reason: 'withdrawn', version: record.consentVersion, acceptedAt: record.acceptedAt };
    }
    if (record.consentVersion !== CONSENT_VERSION || record.consentTextHash !== consentTextHash()) {
      return { contributable: false, reason: 'outdated_version', version: record.consentVersion, acceptedAt: record.acceptedAt };
    }
    return {
      contributable: true,
      version: record.consentVersion,
      acceptedAt: record.acceptedAt,
      subjectPseudonym: record.subjectPseudonym,
    };
  }

  async acceptConsent(userId: string, dto: AcceptDatasetConsentDto) {
    if (!dto.accepted) throw new BadRequestException({ code: 'DATASET_CONSENT_REQUIRED', message: 'Contribution requires explicit consent.' });
    if (dto.version !== CONSENT_VERSION || dto.textHash !== consentTextHash()) {
      throw new BadRequestException({ code: 'DATASET_CONSENT_STALE', message: 'The consent text changed. Reload it and accept again.' });
    }
    const subjectPseudonym = this.subject(userId);
    const record = await this.fence().withActiveWrite(userId, session => this.consents.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      {
        $set: {
          consentVersion: CONSENT_VERSION,
          consentTextHash: consentTextHash(),
          subjectPseudonym,
          acceptedAt: new Date(),
          withdrawnAt: null,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, session },
    ));
    return { contributable: true, version: record.consentVersion, acceptedAt: record.acceptedAt, subjectPseudonym };
  }

  /**
   * Withdrawal is destructive on purpose: the consent record is replaced by a
   * tombstone and every contributed clip and payload is deleted.
   */
  async withdrawConsent(userId: string) {
    const objectId = new Types.ObjectId(userId);
    const deleted = await this.fence().withActiveWrite(userId, async session => {
      const owned = await this.clips.find({ userId: objectId }, { _id: 1 }, { session }).lean();
      await this.payloads.deleteMany({ clipId: { $in: owned.map(clip => clip._id) } }, { session });
      const result = await this.clips.deleteMany({ userId: objectId }, { session });
      await this.consents.updateOne(
        { userId: objectId },
        { $set: { withdrawnAt: new Date() } },
        { upsert: false, session },
      );
      return result;
    });
    this.logger.log({ event: 'dataset_consent_withdrawn', clips: deleted.deletedCount });
    return { withdrawn: true, deletedClips: deleted.deletedCount };
  }

  private async requireConsent(userId: string) {
    const state = await this.state(userId);
    if (!state.contributable) {
      throw new ForbiddenException({
        code: 'DATASET_CONSENT_REQUIRED',
        message: 'Accept the model-development consent before contributing recordings.',
        reason: state.reason,
      });
    }
    return state;
  }

  async submit(userId: string, dto: SubmitDatasetClipDto) {
    const consent = await this.requireConsent(userId);
    const payload: DatasetPayload = { fps: dto.fps, timestampsMs: dto.timestampsMs, frames: dto.frames };
    const quality = validatePayload(payload);

    const boundaries = dto.repBoundaries ?? [];
    for (const boundary of boundaries) {
      if (!(boundary.startFrame < boundary.endFrame) || boundary.endFrame > quality.frames) {
        throw new BadRequestException({ code: 'DATASET_REP_BOUNDARY', message: 'Rep boundaries must be increasing and inside the clip' });
      }
    }

    const sha256 = payloadHash(payload);
    const existing = await this.clips.exists({ payloadSha256: sha256 });
    if (existing) throw new ConflictException({ code: 'DATASET_DUPLICATE', message: 'This recording was already contributed.' });

    const data = gzipSync(Buffer.from(JSON.stringify({ payloadVersion: PAYLOAD_VERSION, ...payload })), { level: 9 });
    let clip;
    try {
      // Clip and payload commit together, so a deletion race cannot leave either one behind.
      clip = await this.fence().withActiveWrite(userId, async session => {
        const [created] = await this.clips.create([{
          userId: new Types.ObjectId(userId),
          subjectPseudonym: consent.subjectPseudonym ?? this.subject(userId),
          exerciseId: dto.exerciseId,
          exerciseName: dto.exerciseName,
          pattern: dto.pattern as Pattern,
          cameraPlacement: dto.cameraPlacement,
          cameraFacing: dto.cameraFacing,
          orientation: dto.orientation,
          durationSeconds: quality.durationSeconds,
          frameCount: quality.frames,
          detectionRate: quality.detectionRate,
          medianFrameIntervalMs: quality.medianFrameIntervalMs,
          appVersion: dto.appVersion,
          consentVersion: consent.version,
          repBoundaries: boundaries,
          declaredReps: dto.declaredReps,
          payloadSha256: sha256,
          payloadBytes: data.length,
          status: 'pending_annotation',
          qualityFlags: quality.detectionRate < 0.85 ? ['low_detection'] : [],
        }], { session });
        await this.payloads.create([{ clipId: created._id, data, sha256 }], { session });
        return created;
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException({ code: 'DATASET_DUPLICATE', message: 'This recording was already contributed.' });
      }
      throw error;
    }
    this.logger.log({ event: 'dataset_clip_submitted', clip: String(clip._id) });
    return { id: String(clip._id), status: clip.status, quality };
  }

  async list(userId: string, status?: ClipStatus) {
    const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
    if (status) filter.status = status;
    const clips = await this.clips.find(filter, { annotation: 0 }).sort({ createdAt: -1 }).limit(100).lean();
    return {
      clips: clips.map(clip => ({
        id: String(clip._id),
        exerciseId: clip.exerciseId,
        exerciseName: clip.exerciseName,
        pattern: clip.pattern,
        status: clip.status,
        durationSeconds: clip.durationSeconds,
        frameCount: clip.frameCount,
        detectionRate: clip.detectionRate,
        createdAt: (clip as unknown as { createdAt: Date }).createdAt,
      })),
    };
  }

  async get(userId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException();
    const clip = await this.clips.findOne({ _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) }).lean();
    if (!clip) throw new NotFoundException();
    const { userId: _ignored, ...rest } = clip;
    return { id: String(clip._id), ...rest };
  }

  /** Owner-side removal of a single contribution. */
  async removeClip(userId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException();
    const clip = await this.fence().withActiveWrite(userId, async session => {
      const removed = await this.clips.findOneAndDelete({ _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) }, { session });
      if (removed) await this.payloads.deleteOne({ clipId: removed._id }, { session });
      return removed;
    });
    if (!clip) throw new NotFoundException();
    return { deleted: true };
  }

  /** Annotation queue for reviewers: metadata only, no payloads, no user ids. */
  async queue(status: ClipStatus = 'pending_annotation', limit = 25) {
    const clips = await this.clips
      .find({ status }, { userId: 0, payloadSha256: 0 })
      .sort({ createdAt: 1 })
      .limit(Math.min(Math.max(limit, 1), 100))
      .lean();
    return { clips: clips.map(clip => ({ id: String(clip._id), ...clip })) };
  }

  async annotate(id: string, dto: AnnotateDatasetClipDto, annotatorRef: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException();
    const clip = await this.clips.findById(id);
    if (!clip) throw new NotFoundException();
    const maxFrame = clip.frameCount;
    const boundaries = dto.repBoundaries ?? [];
    const phases = dto.phases ?? [];
    for (const item of [...boundaries, ...phases]) {
      if (!(item.startFrame < item.endFrame) || item.endFrame > maxFrame) {
        throw new BadRequestException({ code: 'DATASET_ANNOTATION_RANGE', message: 'Annotation ranges must be increasing and inside the clip' });
      }
    }
    const annotation: ClipAnnotation = {
      exerciseId: dto.exerciseId,
      pattern: dto.pattern as Pattern,
      correctness: dto.correctness,
      movementStartFrame: dto.movementStartFrame,
      movementEndFrame: dto.movementEndFrame,
      repBoundaries: boundaries,
      phases,
      formDeviations: dto.formDeviations ?? [],
      keypointQuality: dto.keypointQuality,
      notes: dto.notes,
      annotatorRef,
      annotatedAt: new Date(),
    };
    clip.annotation = annotation;
    clip.status = dto.decision;
    await clip.save();
    return { id, status: clip.status, annotation };
  }

  /** Used by the export script and by tests; keeps decompression in one place. */
  async payloadFor(clipId: string): Promise<DatasetPayload & { payloadVersion: string }> {
    if (!Types.ObjectId.isValid(clipId)) throw new NotFoundException();
    const record = await this.payloads.findOne({ clipId: new Types.ObjectId(clipId) }).lean();
    if (!record) throw new NotFoundException();
    const parsed = JSON.parse(gunzipSync(record.data).toString('utf8'));
    return parsed as DatasetPayload & { payloadVersion: string };
  }
}
