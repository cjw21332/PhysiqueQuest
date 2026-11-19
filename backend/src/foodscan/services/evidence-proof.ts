import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { foodEvidenceSchema } from '../foodscan.schemas.js';

const payloadSchema = z.object({ userId: z.string().min(1), name: z.string().min(1).max(120), grams: z.number().finite().positive().max(5000), evidence: foodEvidenceSchema, itemId: z.string().uuid().optional(), scan: z.object({ id: z.string().uuid(), image: z.string().regex(/^[a-f0-9]{64}$/), analysis: z.string().regex(/^[a-f0-9]{64}$/) }).strict().optional(), expires: z.number().finite() }).strict();
type Payload = z.infer<typeof payloadSchema>;
function signature(data: string, secret: string) { return createHmac('sha256', secret).update(`food-evidence-v1:${data}`).digest('base64url'); }

/** Server-issued, account-bound evidence. It contains no photo or description. */
export function issueEvidenceProof(userId: string, name: string, grams: number, evidence: Payload['evidence'], scan?: Payload['scan']): string | undefined {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret || !userId) return undefined;
  const payload = payloadSchema.parse({ userId, name, grams, evidence, ...(scan ? { scan, itemId: randomUUID() } : {}), expires: Date.now() + 24 * 60 * 60 * 1000 });
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `ev1.${data}.${signature(data, secret)}`;
}

export function readEvidenceProof(proof: string, userId: string): Payload | undefined {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret || proof.length > 2048) return undefined;
  const [version, data, mac, extra] = proof.split('.');
  if (version !== 'ev1' || !data || !mac || extra) return undefined;
  const expected = Buffer.from(signature(data, secret)); const actual = Buffer.from(mac);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return undefined;
  try {
    const payload = payloadSchema.parse(JSON.parse(Buffer.from(data, 'base64url').toString('utf8')));
    return payload.userId === userId && payload.expires >= Date.now() ? payload : undefined;
  } catch { return undefined; }
}
