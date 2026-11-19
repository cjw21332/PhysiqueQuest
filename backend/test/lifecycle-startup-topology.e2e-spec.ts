import { randomBytes } from 'node:crypto';
import { createConnection, type Connection } from 'mongoose';
import { assertLifecycleReadiness } from '../src/privacy/lifecycle-readiness.js';

const standaloneUri = process.env.PQ_TEST_STANDALONE_URI;
const replicaUri = process.env.PQ_TEST_REPLICA_URI;

describe.skipIf(!standaloneUri)('startup rejects an incompatible standalone topology', () => {
  let connection: Connection;
  beforeAll(async () => {
    connection = await createConnection(standaloneUri!, { dbName: `pq_standalone_probe_${randomBytes(8).toString('hex')}`, serverSelectionTimeoutMS: 5000 }).asPromise();
  });
  afterAll(async () => { if (connection) await connection.close(); });
  it('fails closed before creating indexes or accepting traffic', async () => {
    const hello = await connection.db!.admin().command({ hello: 1 });
    expect(hello.setName).toBeUndefined();
    await expect(assertLifecycleReadiness(connection)).rejects.toThrow('replica set or sharded cluster');
  });
});

describe.skipIf(!replicaUri)('startup accepts a transaction-capable replica set', () => {
  let connection: Connection;
  beforeAll(async () => {
    connection = await createConnection(replicaUri!, { dbName: `pq_ready_probe_${randomBytes(8).toString('hex')}`, serverSelectionTimeoutMS: 5000 }).asPromise();
  });
  afterAll(async () => {
    if (connection) {
      if (/^pq_ready_probe_[a-f0-9]{16}$/.test(connection.name)) await connection.dropDatabase();
      await connection.close();
    }
  });
  it('proves sessions and an aborted transaction without mutating an account', async () => {
    await assertLifecycleReadiness(connection);
    const hello = await connection.db!.admin().command({ hello: 1 });
    expect(hello.setName).toBe('pqtest');
    expect(hello.logicalSessionTimeoutMinutes).toBeGreaterThan(0);
  });
});
