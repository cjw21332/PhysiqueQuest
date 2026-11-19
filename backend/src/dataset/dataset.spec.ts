import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { Types } from 'mongoose';
import type { Model } from 'mongoose';
import { CONSENT_TEXT, CONSENT_VERSION, consentTextHash, pseudonymize } from './dataset-consent.js';
import { payloadHash, validatePayload } from './dataset-payload.js';
import { DatasetService } from './dataset.service.js';
import type { DatasetClip } from './schemas/dataset-clip.schema.js';
import type { DatasetClipPayload } from './schemas/dataset-clip.schema.js';
import type { DatasetConsent } from './schemas/dataset-consent.schema.js';

const USER = new Types.ObjectId().toHexString();

function goodPayload(frames = 120) {
  const timestampsMs = Array.from({ length: frames }, (_, i) => i * (1000 / 15));
  const body = Array.from({ length: frames }, (_, i) => {
    const values = new Array(132).fill(0);
    values[0] = Math.sin(i / 8) * 0.1;
    values[1] = Math.cos(i / 8) * 0.1;
    values[3] = 0.9; // raw visibility must survive
    return values;
  });
  return { fps: 15, timestampsMs, frames: body };
}

function clipDto(payload = goodPayload()) {
  return {
    exerciseId: 'squat',
    exerciseName: 'Bodyweight squat',
    pattern: 'squat',
    cameraPlacement: 'diagonal' as const,
    cameraFacing: 'back' as const,
    orientation: 'portrait' as const,
    appVersion: '5.1.0',
    fps: payload.fps,
    timestampsMs: payload.timestampsMs,
    frames: payload.frames,
  };
}

function modelMock(overrides: Record<string, Mock> = {}) {
  return overrides as unknown as Model<never>;
}

function service(overrides: {
  consent?: Record<string, unknown> | null;
  exists?: boolean;
  clips?: Record<string, Mock>;
  payloads?: Record<string, Mock>;
  consents?: Record<string, Mock>;
} = {}) {
  const consents = modelMock({
    findOne: vi.fn().mockReturnValue({ lean: () => Promise.resolve(overrides.consent ?? null) }),
    findOneAndUpdate: vi.fn().mockResolvedValue({
      consentVersion: CONSENT_VERSION,
      acceptedAt: new Date('2026-11-16T00:00:00Z'),
      subjectPseudonym: 'abc123abc123abc123abc123',
    }),
    updateOne: vi.fn().mockResolvedValue({}),
    ...overrides.consents,
  }) as unknown as Model<DatasetConsent>;
  const clips = modelMock({
    exists: vi.fn().mockResolvedValue(overrides.exists ? { _id: 'x' } : null),
    create: vi.fn().mockResolvedValue({ _id: new Types.ObjectId(), status: 'pending_annotation' }),
    find: vi.fn().mockReturnValue({ lean: () => Promise.resolve([{ _id: new Types.ObjectId() }, { _id: new Types.ObjectId() }]) }),
    deleteMany: vi.fn().mockResolvedValue({ deletedCount: 2 }),
    findOneAndDelete: vi.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
    ...overrides.clips,
  }) as unknown as Model<DatasetClip>;
  const payloads = modelMock({
    create: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({ deletedCount: 2 }),
    deleteOne: vi.fn().mockResolvedValue({}),
    ...overrides.payloads,
  }) as unknown as Model<DatasetClipPayload>;
  return new DatasetService(consents, clips, payloads);
}

describe('dataset payload validation', () => {
  beforeEach(() => {
    process.env.DATASET_PSEUDONYM_SECRET = 'test-secret-that-is-long-enough';
  });

  it('accepts a 15 fps sequence and recomputes quality', () => {
    const quality = validatePayload(goodPayload(120));
    expect(quality.frames).toBe(120);
    expect(quality.durationSeconds).toBeCloseTo(7.9, 1);
    expect(quality.detectionRate).toBe(1);
    expect(Math.round(quality.medianFrameIntervalMs)).toBe(67);
  });

  it('rejects the wrong frame rate, short clips, bad timestamps and non-finite values', () => {
    expect(() => validatePayload({ ...goodPayload(), fps: 30 })).toThrow(BadRequestException);
    expect(() => validatePayload(goodPayload(30))).toThrow(BadRequestException);
    const unsorted = goodPayload();
    unsorted.timestampsMs[10] = unsorted.timestampsMs[9];
    expect(() => validatePayload(unsorted)).toThrow(BadRequestException);
    const broken = goodPayload();
    broken.frames[5][7] = Number.NaN;
    expect(() => validatePayload(broken)).toThrow(BadRequestException);
  });

  it('rejects clips where the body is missing from most frames', () => {
    const empty = goodPayload();
    for (let i = 0; i < 60; i++) empty.frames[i] = new Array(132).fill(0);
    expect(() => validatePayload(empty)).toThrow(/trackable body/);
  });

  it('hashes content so an identical re-upload is detected', () => {
    expect(payloadHash(goodPayload())).toBe(payloadHash(goodPayload()));
    const changed = goodPayload();
    changed.frames[3][5] += 0.01;
    expect(payloadHash(changed)).not.toBe(payloadHash(goodPayload()));
  });
});

describe('dataset consent and pseudonymisation', () => {
  beforeEach(() => {
    process.env.DATASET_PSEUDONYM_SECRET = 'test-secret-that-is-long-enough';
  });

  it('derives a stable study code that is not the account id', () => {
    const a = pseudonymize(USER, 'test-secret-that-is-long-enough');
    expect(a).toBe(pseudonymize(USER, 'test-secret-that-is-long-enough'));
    expect(a).not.toContain(USER.slice(0, 8));
    expect(a).toHaveLength(24);
    expect(pseudonymize(USER, 'another-secret-that-is-long')).not.toBe(a);
  });

  it('reports no consent until the exact current text version is accepted', async () => {
    expect((await service().state(USER)).contributable).toBe(false);
    const stale = service({ consent: { consentVersion: '2026-01-01.v0', consentTextHash: consentTextHash(), withdrawnAt: null } });
    expect((await stale.state(USER)).reason).toBe('outdated_version');
    const withdrawn = service({ consent: { consentVersion: CONSENT_VERSION, consentTextHash: consentTextHash(), withdrawnAt: new Date() } });
    expect((await withdrawn.state(USER)).contributable).toBe(false);
    const active = service({ consent: { consentVersion: CONSENT_VERSION, consentTextHash: consentTextHash(), withdrawnAt: null, acceptedAt: new Date(), subjectPseudonym: 'x' } });
    expect((await active.state(USER)).contributable).toBe(true);
  });

  it('refuses a stale or rejected consent submission', async () => {
    await expect(
      service().acceptConsent(USER, { version: CONSENT_VERSION, accepted: true, textHash: 'deadbeef' }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service().acceptConsent(USER, { version: CONSENT_VERSION, accepted: false, textHash: consentTextHash() }),
    ).rejects.toThrow(/explicit consent/);
  });

  it('refuses to store a clip without consent', async () => {
    await expect(service().submit(USER, clipDto() as never)).rejects.toThrow(ForbiddenException);
  });

  it('stores a consented clip with the pseudonym and rejects duplicates', async () => {
    const consent = {
      consentVersion: CONSENT_VERSION,
      consentTextHash: consentTextHash(),
      withdrawnAt: null,
      acceptedAt: new Date(),
      subjectPseudonym: 'study-code-123456789012',
    };
    const created = vi.fn().mockResolvedValue({ _id: new Types.ObjectId(), status: 'pending_annotation' });
    const result = await service({ consent, clips: { create: created } }).submit(USER, clipDto() as never);
    expect(result.status).toBe('pending_annotation');
    const stored = created.mock.calls[0][0];
    expect(stored.subjectPseudonym).toBe('study-code-123456789012');
    // The stored clip is owned by the account (needed for withdrawal) but the
    // subject identity used for training is only the pseudonym.
    expect(stored.subjectPseudonym).not.toBe(USER);
    expect(stored).not.toHaveProperty('email');
    expect(stored).not.toHaveProperty('displayName');
    await expect(service({ consent, exists: true }).submit(USER, clipDto() as never)).rejects.toThrow(ConflictException);
  });

  it('deletes clips and payloads on withdrawal', async () => {
    const payloadDelete = vi.fn().mockResolvedValue({ deletedCount: 2 });
    const consentUpdate = vi.fn().mockResolvedValue({});
    const result = await service({ payloads: { deleteMany: payloadDelete }, consents: { updateOne: consentUpdate } }).withdrawConsent(USER);
    expect(result.deletedClips).toBe(2);
    expect(payloadDelete).toHaveBeenCalled();
    expect(consentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: expect.anything() }),
      expect.objectContaining({ $set: expect.objectContaining({ withdrawnAt: expect.any(Date) }) }),
      expect.anything(),
    );
  });

  it('exposes the consented text, version and its hash', () => {
    const document = service().consentDocument();
    expect(document.version).toBe(CONSENT_VERSION);
    expect(document.text).toContain('separate from camera permission');
    expect(document.textHash).toBe(consentTextHash(CONSENT_TEXT));
  });
});
