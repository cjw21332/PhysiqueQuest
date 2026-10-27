import { describe, expect, it, vi } from 'vitest';
import { ProfileService } from './profile.service.js';

describe('profile photo', () => {
  it('saves and removes only the owner’s photo and rejects invalid bytes', async () => {
    const update = vi.fn().mockResolvedValue({ photo: '' });
    const service = new ProfileService({ findOneAndUpdate: update } as never);
    const owner = 'aaaaaaaaaaaaaaaaaaaaaaaa';
    const image = 'data:image/jpeg;base64,/9j/4AAQ';
    await service.updatePhoto(owner, image);
    expect(String(update.mock.calls[0][0].userId)).toBe(owner);
    expect(update.mock.calls[0][1].$set.photo).toBe(image);
    await service.updatePhoto(owner, '');
    expect(update.mock.calls[1][1].$set.photo).toBe('');
    await expect(service.updatePhoto(owner, 'data:image/jpeg;base64,YWJj')).rejects.toThrow('valid image');
  });
});
