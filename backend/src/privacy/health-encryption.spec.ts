import { randomBytes } from 'node:crypto';
import { decryptProfile, transformProfile } from './health-encryption.js';
describe('owner-bound profile encryption', () => {
  const saved = process.env.HEALTH_DATA_ENCRYPTION_KEY;
  beforeEach(() => { process.env.HEALTH_DATA_ENCRYPTION_KEY = randomBytes(32).toString('base64'); });
  afterEach(() => { if (saved === undefined) delete process.env.HEALTH_DATA_ENCRYPTION_KEY; else process.env.HEALTH_DATA_ENCRYPTION_KEY = saved; });
  const plain = () => ({ userId: '0123456789abcdef01234567', conditions: ['Asthma'], healthNotes: 'Private', contactName: 'Person', contactPhone: '123', contactRelationship: 'Friend' });
  it('roundtrips all fields and leaves public fields alone', () => {
    const input = plain(), encrypted = transformProfile(structuredClone(input), true);
    expect(encrypted.conditions[0]).toMatch(/^pqenc:v1:/);
    expect(encrypted.healthNotes).not.toBe(input.healthNotes);
    expect(decryptProfile(encrypted)).toEqual(input);
  });
  it('rejects ciphertext tampering, swapped owners and swapped fields without leaking contents', () => {
    const encrypted = transformProfile(plain(), true);
    expect(() => decryptProfile({ ...encrypted, userId: '1123456789abcdef01234567' })).toThrow('Health data encryption unavailable');
    expect(() => decryptProfile({ ...encrypted, contactPhone: encrypted.contactName })).toThrow('Health data encryption unavailable');
    expect(() => decryptProfile({ ...encrypted, healthNotes: encrypted.healthNotes + 'x' })).toThrow('Health data encryption unavailable');
  });
  it('fails closed for missing or wrong keys and supports rerunnable transformations', () => {
    const encrypted = transformProfile(plain(), true);
    expect(transformProfile(structuredClone(encrypted), true)).toEqual(encrypted);
    delete process.env.HEALTH_DATA_ENCRYPTION_KEY;
    expect(() => decryptProfile(structuredClone(encrypted))).toThrow('Health data encryption unavailable');
    expect(decryptProfile(plain())).toEqual(plain());
    process.env.HEALTH_DATA_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    expect(() => decryptProfile(structuredClone(encrypted))).toThrow('Health data encryption unavailable');
  });
});
