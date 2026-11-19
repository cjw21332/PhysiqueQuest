import { describe, expect, it } from 'vitest';
import { attributeEvidence } from './evidence-attribution.js';
import type { DetectedItem } from './vision-provider.js';

// Synthetic claim fixtures exercise attribution rules; these are not image
// recognition ground truth and must not be reported as model accuracy.
const unknown = { source: 'unknown', quote: '' } as const;
const cases: { title: string; description?: string; item: DetectedItem; expected: string }[] = [
  { title: 'exact grams', description: '150g grilled chicken breast', item: { food_name: 'grilled chicken breast', est_weight_g: 150, confidence: 0.5, evidence_claims: { name: { source: 'image', quote: '' }, quantity: { source: 'description', quote: '150g grilled chicken breast' }, preparation: unknown, added_oil: unknown } }, expected: 'user_confirmed' },
  { title: 'invented quote', description: '100g grilled chicken breast', item: { food_name: 'grilled chicken breast', est_weight_g: 150, confidence: 0.5, evidence_claims: { name: unknown, quantity: { source: 'description', quote: '150g grilled chicken breast' }, preparation: unknown, added_oil: unknown } }, expected: 'estimated' },
  { title: 'unconverted household quantity', description: 'one cup of white rice', item: { food_name: 'white rice', est_weight_g: 160, confidence: 0.5, evidence_claims: { name: unknown, quantity: { source: 'description', quote: 'one cup of white rice' }, preparation: unknown, added_oil: unknown } }, expected: 'estimated' },
  { title: 'image-only amount', item: { food_name: 'rice', est_weight_g: 100, confidence: 0.5, evidence_claims: { name: { source: 'image', quote: '' }, quantity: { source: 'image', quote: '' }, preparation: unknown, added_oil: unknown } }, expected: 'estimated' },
];
describe('synthetic evidence evaluation', () => {
  it.each(cases)('$title', ({ item, description, expected }) => {
    expect(attributeEvidence(item, description).quantity).toBe(expected);
  });
});
