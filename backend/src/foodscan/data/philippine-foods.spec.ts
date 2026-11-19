import { describe, expect, it } from 'vitest';
import { philippineFoodSeed, validatePhilippineFood } from './philippine-foods.js';
import { foodSearchTerms } from '../services/food-synonyms.js';

describe('Philippine food data', () => {
  it('requires provenance and leaves unverified carbohydrate unavailable', () => {
    expect(philippineFoodSeed[0].carbs).toBeNull();
    expect(() => validatePhilippineFood({ ...philippineFoodSeed[0], sourceRef: '' })).toThrow();
    expect(() => validatePhilippineFood({ ...philippineFoodSeed[0], source: '' })).toThrow();
  });
  it('resolves common aliases without assigning nutrition values', () => {
    expect(foodSearchTerms(' KANIN ')[0]).toBe('cooked white rice');
    expect(foodSearchTerms('itlog')[0]).toBe('egg');
    expect(foodSearchTerms('Adobong Manok')[0]).toBe('chicken adobo');
  });
});
