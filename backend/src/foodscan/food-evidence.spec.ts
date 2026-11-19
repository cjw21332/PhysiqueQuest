import { describe, expect, it } from 'vitest';
import { foodEvidenceSchema } from './foodscan.schemas.js';

describe('food evidence validation', () => {
  it('accepts different evidence per property', () => {
    expect(foodEvidenceSchema.parse({ name: 'visually_identified', quantity: 'user_confirmed', preparation: 'estimated', added_oil: 'unknown' })).toEqual({ name: 'visually_identified', quantity: 'user_confirmed', preparation: 'estimated', added_oil: 'unknown' });
  });
  it('rejects invalid or additional evidence', () => {
    expect(foodEvidenceSchema.safeParse({ name: 'verified', quantity: 'estimated', preparation: 'unknown', added_oil: 'unknown' }).success).toBe(false);
    expect(foodEvidenceSchema.safeParse({ name: 'unknown', quantity: 'estimated', preparation: 'unknown', added_oil: 'unknown', extra: 'user_confirmed' }).success).toBe(false);
  });
});
