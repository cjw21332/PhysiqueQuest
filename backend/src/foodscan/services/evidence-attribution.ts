import type { DetectedItem } from './vision-provider.js';
import type { z } from 'zod';
import type { foodEvidenceSchema } from '../foodscan.schemas.js';

type Evidence = z.infer<typeof foodEvidenceSchema>;
const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

/** Claims are model observations, not proof. Description claims must quote the input and support the particular value. */
export function attributeEvidence(item: DetectedItem, description?: string): Evidence {
  const evidence: Evidence = { name: 'unknown', quantity: 'estimated', preparation: 'unknown', added_oil: 'unknown' };
  const claims = item.evidence_claims;
  if (!claims) return evidence;
  for (const property of ['name', 'quantity', 'preparation', 'added_oil'] as const) {
    const claim = claims[property];
    if (claim.source === 'image') {
      if (property !== 'quantity') evidence[property] = 'visually_identified';
      continue;
    }
    if (claim.source === 'estimated') { evidence[property] = 'estimated'; continue; }
    if (claim.source !== 'description' || !description || !claim.quote.trim()) continue;
    const quote = normalize(claim.quote), input = normalize(description);
    if (!input.includes(quote)) continue;
    if (property === 'name' && !quote.includes(normalize(item.food_name))) continue;
    if (property === 'quantity') {
      // Exact mass conversions are food-independent; volume and count are not.
      // Approximate wording cannot establish a precise gram value.
      const preceding = input.slice(Math.max(0, input.indexOf(quote) - 24), input.indexOf(quote));
      if (/\b(?:about|around|approximately|approx|roughly|nearly|almost)\b|[~≈]/i.test(quote) || /(?:\b(?:about|around|approximately|approx|roughly|nearly|almost)\s*|[~≈]\s*)$/i.test(preceding)) continue;
      const amounts = [...quote.matchAll(/\b(\d+(?:\.\d+)?)\s*(kg|kilograms?|g|grams?|grammes?|oz|ounces?|lb|lbs|pounds?)\b/g)];
      if (amounts.length !== 1 || !quote.includes(normalize(item.food_name))) continue;
      const unit = amounts[0][2];
      const factor = /^(kg|kilogram)/.test(unit) ? 1000 : /^(oz|ounce)/.test(unit) ? 28.349523125 : /^(lb|pound)/.test(unit) ? 453.59237 : 1;
      if (Math.abs(Number(amounts[0][1]) * factor - item.est_weight_g) > 0.11) continue;
    }
    if (property === 'preparation') {
      const method = quote.match(/\b(grilled|fried|boiled|steamed|roasted|baked|sauteed|sautéed|air.fried|raw)\b/i)?.[0];
      if (!method || !normalize(item.food_name).includes(normalize(method))) continue;
    }
    if (property === 'added_oil' && (!/\b(oil|butter|margarine)\b/i.test(quote) || !quote.includes(normalize(item.food_name)))) continue;
    evidence[property] = 'user_confirmed';
  }
  return evidence;
}
