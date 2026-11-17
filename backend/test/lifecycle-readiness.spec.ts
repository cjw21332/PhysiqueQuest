import { describe, expect, it } from 'vitest';
import { assertLifecycleReadiness } from '../src/privacy/lifecycle-readiness.js';

describe('lifecycle topology gate', () => {
  it('rejects standalone before any index or account mutation', async () => {
    const connection = { db: { admin: () => ({ command: async () => ({ isWritablePrimary: true, logicalSessionTimeoutMinutes: 30 }) }), collection: () => { throw Error('Must not write'); } } };
    await expect(assertLifecycleReadiness(connection as never)).rejects.toThrow('replica set');
  });
  it('fails closed when database access is unavailable', async () => {
    await expect(assertLifecycleReadiness({} as never)).rejects.toThrow('unavailable');
  });
});
