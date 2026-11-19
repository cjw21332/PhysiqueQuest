import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ScannedMealItemDto } from './dto/nutrition.dto.js';

describe('scan save metadata', () => {
  it('accepts the detection fields when the review sends the item back', async () => {
    const item = plainToInstance(ScannedMealItemDto, { food_name: 'adobo', found: false, est_weight_g: 100, localName: 'adobo', searchTerms: ['chicken adobo', 'adobong manok'], isComposite: true, portionDescription: '1 cup', kcal: null, protein_g: null, carbs_g: null, fat_g: null });
    expect(await validate(item, { whitelist: true, forbidNonWhitelisted: true })).toEqual([]);
  });
});
