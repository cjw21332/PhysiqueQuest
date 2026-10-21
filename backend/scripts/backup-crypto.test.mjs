import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { backupKey, encryptBackup, decryptBackup } from './backup-crypto.mjs';
test('encrypted backup roundtrip authenticates before exposing restored plaintext', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pq-backup-test-'));
  try {
    const plain = join(directory, 'plain'), encrypted = join(directory, 'encrypted'), restored = join(directory, 'restored');
    const fixture = Buffer.concat([Buffer.from('synthetic backup fixture\n'), randomBytes(1024 * 1024)]);
    const key = backupKey(randomBytes(32).toString('base64'));
    await writeFile(plain, fixture); await encryptBackup(plain, encrypted, key);
    assert(!(await readFile(encrypted)).includes(Buffer.from('synthetic backup fixture')));
    await decryptBackup(encrypted, restored, key); assert.deepEqual(await readFile(restored), fixture);
    const bytes = await readFile(encrypted); bytes[30] ^= 1; await writeFile(encrypted, bytes);
    await assert.rejects(decryptBackup(encrypted, join(directory, 'tampered-output'), key), /authentication failed/);
    await assert.rejects(access(join(directory, 'tampered-output')));
    await assert.rejects(decryptBackup(encrypted, join(directory, 'wrong-key'), randomBytes(32)), /authentication failed/);
    assert.throws(() => backupKey('invalid'), /BACKUP_ENCRYPTION_KEY/);
  } finally {
    if (!resolve(directory).startsWith(resolve(tmpdir()) + '\\') && !resolve(directory).startsWith(resolve(tmpdir()) + '/')) throw new Error('Unsafe cleanup');
    await rm(directory, { recursive: true, force: true });
  }
});
