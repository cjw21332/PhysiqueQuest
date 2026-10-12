import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { AuthService } from '../src/auth/auth.service.js';

const userRecord = async () => ({
  _id: '507f1f77bcf86cd799439011',
  email: 'lifter@example.com',
  name: 'Lifter',
  isActive: true,
  failedLoginAttempts: 0,
  lockoutUntil: null,
  passwordHash: await bcrypt.hash('correct horse', 4),
});

describe('sign-in event collection', () => {
  it('records one event per successful login', async () => {
    const user = await userRecord();
    const userModel = {
      findOne: vi.fn(() => ({ select: async () => user })),
      updateOne: vi.fn(async () => ({})),
      findByIdAndUpdate: vi.fn(),
    };
    const signInEvents = { create: vi.fn(async () => ({})) };
    const jwt = { sign: vi.fn(() => 'jwt-token') };
    const service = new AuthService(userModel as any, signInEvents as any, jwt as any);

    await service.login({ email: user.email, password: 'correct horse' });

    expect(signInEvents.create).toHaveBeenCalledTimes(1);
    expect(signInEvents.create).toHaveBeenCalledWith(expect.objectContaining({ source: 'login' }));
  });

  it('does not record an event when the password is wrong', async () => {
    const user = await userRecord();
    const userModel = {
      findOne: vi.fn(() => ({ select: async () => user })),
      updateOne: vi.fn(async () => ({})),
      findByIdAndUpdate: vi.fn(async () => ({ failedLoginAttempts: 1 })),
    };
    const signInEvents = { create: vi.fn(async () => ({})) };
    const jwt = { sign: vi.fn(() => 'jwt-token') };
    const service = new AuthService(userModel as any, signInEvents as any, jwt as any);

    await expect(service.login({ email: user.email, password: 'wrong' })).rejects.toThrow();
    expect(signInEvents.create).not.toHaveBeenCalled();
  });
});
