import { beforeEach, describe, expect, it, vi } from 'vitest';

let user = 'first';
vi.mock('../lib/auth', () => ({ getCurrentUser: () => user ? { id: user } : null }));
vi.mock('../lib/api', () => ({ getApiBaseUrl: () => 'https://example.test/api' }));
import { readPersonalExercises, savePersonalExercises } from '../lib/personalExercises';

describe('personal exercises', () => {
  const values = new Map<string, string>();
  beforeEach(() => {
    values.clear(); user = 'first';
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
    vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  });
  it('persists only for the current account on this device', () => {
    const item = { _id: 'personal-one', name: 'My lift', targetMuscle: 'Back', equipment: 'Dumbbells', pose: 'missing' as const };
    savePersonalExercises([item]);
    expect(readPersonalExercises()).toEqual([item]);
    user = 'second';
    expect(readPersonalExercises()).toEqual([]);
    user = 'first';
    expect(readPersonalExercises()).toEqual([item]);
    savePersonalExercises([]);
    expect(readPersonalExercises()).toEqual([]);
  });
  it('does not allow anonymous access', () => {
    user = '';
    expect(() => readPersonalExercises()).toThrow('Sign in');
  });
});
