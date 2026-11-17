import { lifecycleModel } from '../../test/lifecycle-model.fixture.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Model } from 'mongoose';
import { GoogleAuthService } from './google-auth.service.js';
import type { User } from './schemas/user.schema.js';

const identity = { uid: 'google-uid', email: 'person@example.com', name: 'Google Person' };

function fixture() {
  const session = { inTransaction: () => true, withTransaction: async (fn: () => Promise<void>) => fn(), endSession: async () => {} };
  const users = {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    init: vi.fn().mockResolvedValue(undefined),
    create: vi.fn(),
    db: { startSession: async () => session, collection: () => ({ findOne: async () => ({ status: 'active', generation: 0 }), insertOne: async () => ({}), updateOne: async () => ({ matchedCount: 1 }) }) },
  };
  const signIns = { create: vi.fn().mockResolvedValue(undefined) };
  const identities = { verify: vi.fn().mockResolvedValue(identity) };
  const verification = { consumeRegistration: vi.fn().mockResolvedValue(undefined) };
  const service = new GoogleAuthService(
    lifecycleModel(users as unknown as Model<User>),
    lifecycleModel(signIns as never),
    identities as never,
    verification as never,
  );
  return { service, users, signIns, identities, verification };
}

describe('Google account lifecycle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('directs an unknown Google login to registration', async () => {
    const f = fixture();
    f.users.findOne.mockResolvedValue(null);
    await expect(f.service.login({ idToken: 'google-token' })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'GOOGLE_REGISTRATION_REQUIRED' }),
    });
  });

  it('directs an existing Google account away from registration', async () => {
    const f = fixture();
    f.users.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ isActive: true, deletedAt: null });
    await expect(f.service.check('google-token', 'register')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'GOOGLE_LOGIN_REQUIRED' }),
    });
  });

  it('links a verified Google email to an existing account and returns it for a session', async () => {
    const f = fixture();
    const linked = { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', email: identity.email, isActive: true, googleUid: identity.uid };
    f.users.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', email: identity.email, isActive: true, deletedAt: null });
    f.users.findOneAndUpdate.mockResolvedValue(linked);

    await expect(f.service.login({ idToken: 'google-token' })).resolves.toBe(linked);
    expect(f.users.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', email: identity.email, isActive: true, googleUid: { $exists: false } },
      { $set: expect.objectContaining({ googleUid: identity.uid, emailVerified: true }) },
      { returnDocument: 'after', session: expect.anything() },
    );
    expect(f.verification.consumeRegistration).not.toHaveBeenCalled();
  });

  it('creates a Google account only after consuming the registration OTP', async () => {
    const f = fixture();
    f.users.findOne.mockResolvedValue(null);
    const created = { _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', email: identity.email, name: identity.name };
    f.users.create.mockResolvedValue([created]);

    await expect(f.service.register({
      idToken: 'google-token',
      password: 'StrongPass1',
      requestId: 'a'.repeat(64),
      code: '123456',
      name: identity.name,
    })).resolves.toBe(created);

    expect(f.verification.consumeRegistration).toHaveBeenCalledWith(identity.email, 'a'.repeat(64), '123456');
    expect(f.users.create).toHaveBeenCalledWith([expect.objectContaining({
      email: identity.email,
      name: identity.name,
      googleUid: identity.uid,
      emailVerified: true,
    })], expect.objectContaining({ session: expect.anything() }));
    expect(f.signIns.create).toHaveBeenCalledWith([expect.objectContaining({ source: 'register' })], { session: expect.anything() });
  });

  it('does not consume an OTP when an account already exists', async () => {
    const f = fixture();
    f.users.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: 'existing', isActive: true, deletedAt: null });
    await expect(f.service.register({
      idToken: 'google-token',
      password: 'StrongPass1',
      requestId: 'a'.repeat(64),
      code: '123456',
    })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'GOOGLE_LOGIN_REQUIRED' }),
    });
    expect(f.verification.consumeRegistration).not.toHaveBeenCalled();
    expect(f.users.create).not.toHaveBeenCalled();
  });
});
