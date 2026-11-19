import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { RegisterDto } from './dto/auth.dto.js';
import { GoogleRegisterDto } from './dto/google-auth.dto.js';

const profile = { name: 'Test', age: '25', height: '170', heightUnit: 'cm', weight: '70', weightUnit: 'kg', gender: 'Other', activity: 'Moderate', goal: 'Strength', seriousness: 'Consistent', equipment: ['Dumbbells'], days: ['Monday'], duration: '30 min', conditions: [], contactName: 'Friend', contactPhone: '09123456789' };
const email = { email: 'test@example.com', name: 'Test', password: 'Testing123', requestId: 'a'.repeat(64), code: '123456' };
const google = { idToken: 'test-token', password: 'Testing123', requestId: 'a'.repeat(64), code: '123456' };

describe('completed profile is required for registration', () => {
  it.each([[RegisterDto, email], [GoogleRegisterDto, google]] as const)('rejects incomplete registration for %s', async (Dto, credentials) => {
    expect(await validate(plainToInstance(Dto, credentials))).not.toHaveLength(0);
    expect(await validate(plainToInstance(Dto, { ...credentials, profile: { ...profile, days: [] } }))).not.toHaveLength(0);
    expect(await validate(plainToInstance(Dto, { ...credentials, profile }))).toHaveLength(0);
  });
});
