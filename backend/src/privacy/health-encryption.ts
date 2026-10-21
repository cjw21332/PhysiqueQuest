import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export const HEALTH_FIELDS = ['conditions', 'healthNotes', 'contactName', 'contactPhone', 'contactRelationship'] as const;
const PREFIX = 'pqenc:v1:';
type HealthRecord = Record<string, any>;
function encryptionKey() {
  const value = process.env.HEALTH_DATA_ENCRYPTION_KEY;
  if (!value) return undefined;
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32 || key.toString('base64') !== value) throw new Error('Health data encryption unavailable');
  return key;
}
function transform(value: unknown, owner: unknown, field: string, encrypt: boolean): unknown {
  if (typeof value !== 'string' || value === '') return value;
  try {
    const key = encryptionKey();
    if (!key) {
      if (value.startsWith(PREFIX)) throw new Error();
      return value;
    }
    if (!/^[a-f0-9]{24}$/i.test(String(owner))) throw new Error();
    const aad = Buffer.from(`profile:${owner}:${field}`);
    if (value.startsWith(PREFIX)) {
      const parts = value.slice(PREFIX.length).split('.');
      if (parts.length !== 3) throw new Error();
      const [iv, tag, body] = parts.map(part => Buffer.from(part, 'base64url'));
      if (iv.length !== 12 || tag.length !== 16) throw new Error();
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAAD(aad); decipher.setAuthTag(tag);
      const plain = Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
      return encrypt ? value : plain;
    }
    if (!encrypt) return value;
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(aad);
    const body = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return PREFIX + [iv, cipher.getAuthTag(), body].map(part => part.toString('base64url')).join('.');
  } catch { throw new Error('Health data encryption unavailable'); }
}
export function transformProfile<T extends HealthRecord>(profile: T, encrypt: boolean): T {
  for (const field of HEALTH_FIELDS) {
    const value = profile[field];
    const result = field === 'conditions' && Array.isArray(value)
      ? value.map((entry, index) => transform(entry, profile.userId, `${field}.${index}`, encrypt))
      : transform(value, profile.userId, field, encrypt);
    const changed = Array.isArray(value) && Array.isArray(result) ? value.some((entry, index) => entry !== result[index]) : value !== result;
    if (value !== undefined && changed) {
      (profile as HealthRecord)[field] = result;
      // Reading/decrypting a document must not make a later save overwrite unrelated changes.
      if (!encrypt && typeof profile.unmarkModified === 'function') profile.unmarkModified(field);
    }
  }
  return profile;
}
export const decryptProfile = <T extends HealthRecord>(profile: T): T => transformProfile(profile, false);
