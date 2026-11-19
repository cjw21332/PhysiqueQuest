import { describe, expect, it } from 'vitest';
import { fdcIdParamSchema } from './foodscan.schemas.js';

describe('USDA food identifier compatibility', () => {
  it('accepts both the namespaced and legacy numeric form', () => {
    expect(fdcIdParamSchema.parse({ fdcId: 'usda:123' }).fdcId).toBe(123);
    expect(fdcIdParamSchema.parse({ fdcId: '123' }).fdcId).toBe(123);
    expect(fdcIdParamSchema.safeParse({ fdcId: 'ph:123' }).success).toBe(false);
  });
});
