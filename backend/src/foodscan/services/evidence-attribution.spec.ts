import { afterEach, describe, expect, it, vi } from 'vitest';
import { attributeEvidence } from './evidence-attribution.js';
import { issueEvidenceProof, readEvidenceProof } from './evidence-proof.js';
import type { DetectedItem } from './vision-provider.js';

const item: DetectedItem = { food_name: 'grilled chicken breast', est_weight_g: 150, confidence: 0.8, evidence_claims: {
  name: { source: 'image', quote: '' }, quantity: { source: 'description', quote: '150g grilled chicken breast' }, preparation: { source: 'description', quote: 'grilled' }, added_oil: { source: 'unknown', quote: '' },
} };
describe('evidence attribution', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('separates image, quoted user information, and unknown properties', () => {
    expect(attributeEvidence(item, '150g grilled chicken breast')).toEqual({ name: 'visually_identified', quantity: 'user_confirmed', preparation: 'user_confirmed', added_oil: 'unknown' });
  });
  it('does not accept invented or mismatched quantity quotes', () => {
    expect(attributeEvidence(item, '100g grilled chicken breast').quantity).toBe('estimated');
    expect(attributeEvidence(item).quantity).toBe('estimated');
  });
  it('recognizes exact mass units but not approximate quantities', () => {
    const kgItem = { ...item, est_weight_g: 150, evidence_claims: { ...item.evidence_claims!, quantity: { source: 'description' as const, quote: '0.15 kg grilled chicken breast' } } };
    expect(attributeEvidence(kgItem, '0.15 kg grilled chicken breast').quantity).toBe('user_confirmed');
    const approximate = { ...kgItem, evidence_claims: { ...kgItem.evidence_claims, quantity: { source: 'description' as const, quote: 'about 0.15 kg grilled chicken breast' } } };
    expect(attributeEvidence(approximate, 'about 0.15 kg grilled chicken breast').quantity).toBe('estimated');
    expect(attributeEvidence(kgItem, 'about 0.15 kg grilled chicken breast').quantity).toBe('estimated');
  });
  it('binds signed evidence to the account and rejects tampering', () => {
    vi.stubEnv('JWT_SECRET', 'test-secret');
    const proof = issueEvidenceProof('user-a', item.food_name, 150, attributeEvidence(item))!;
    expect(readEvidenceProof(proof, 'user-a')?.name).toBe('grilled chicken breast');
    expect(readEvidenceProof(proof, 'user-b')).toBeUndefined();
    expect(readEvidenceProof(proof + 'x', 'user-a')).toBeUndefined();
  });
  it('expires signed evidence and rejects altered signed payloads', () => {
    vi.stubEnv('JWT_SECRET', 'test-secret');
    vi.useFakeTimers();
    try {
      const proof = issueEvidenceProof('user-a', item.food_name, 150, attributeEvidence(item))!;
      const [version, data, signature] = proof.split('.');
      const altered = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
      altered.grams = 300;
      expect(readEvidenceProof(`${version}.${Buffer.from(JSON.stringify(altered)).toString('base64url')}.${signature}`, 'user-a')).toBeUndefined();
      vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1);
      expect(readEvidenceProof(proof, 'user-a')).toBeUndefined();
    } finally { vi.useRealTimers(); }
  });
});
