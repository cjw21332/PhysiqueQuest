import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import type { Model } from 'mongoose';
import { ProfileService } from '../src/profile/profile.service.js';
import { UpdateProfileDto } from '../src/profile/dto/profile.dto.js';
import { Profile } from '../src/profile/schemas/profile.schema.js';

const USER = '507f1f77bcf86cd799439011';

describe('profile training-day persistence', () => {
  it('stores the selected canonical weekdays in the profile database record', async () => {
    const storedProfile = {
      age: '30',
      height: '175',
      heightUnit: 'cm',
      weight: '70',
      weightUnit: 'kg',
      userId: USER,
      toObject: () => ({
        age: '30',
        height: '175',
        heightUnit: 'cm',
        weight: '70',
        weightUnit: 'kg',
      }),
    };
    const updatedProfile = { ...storedProfile, days: ['Tuesday', 'Thursday'] };
    const findOne = vi.fn().mockResolvedValue(storedProfile);
    const findOneAndUpdate = vi.fn().mockResolvedValue(updatedProfile);
    const service = new ProfileService({
      findOne,
      findOneAndUpdate,
    } as unknown as Model<Profile>);
    const patch = Object.assign(new UpdateProfileDto(), { days: ['Tuesday', 'Thursday'] });

    await service.update(USER, patch);

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { userId: expect.anything() },
      { $set: { days: ['Tuesday', 'Thursday'] } },
      { returnDocument: 'after', runValidators: true },
    );
  });
});
