import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyzeResponseSchema } from '../src/foodscan/foodscan.schemas.js';

describe('scan response and interface neutrality', () => {
  it('contains no named AI services in Scan client files', () => {
    const dir = resolve(process.cwd(), '../frontend/sections/Scan');
    for (const file of readdirSync(dir)) {
      expect(readFileSync(resolve(dir, file), 'utf8'), file).not.toMatch(/openai|gpt|luna|gemini/i);
    }
  });
  it('strips model metadata from scan responses', () => {
    const response = analyzeResponseSchema.parse({ request_id: 'test', model: 'test', items: [], unmatched: [], totals: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }, degraded: false });
    expect(response).not.toHaveProperty('model');
    expect(response).not.toHaveProperty('provider');
  });
});
