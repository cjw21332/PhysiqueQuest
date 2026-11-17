import { fork, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { createConnection, Types, type Connection } from 'mongoose';

describe.skipIf(!process.env.PQ_TEST_REPLICA_URI)('independent application processes and interruption', () => {
  let db: Connection, owner: Types.ObjectId;
  const children: ChildProcess[] = [];
  function start(mode: string) {
    const child = fork(fileURLToPath(new URL('./lifecycle-process-worker.mjs', import.meta.url)), [db.name, String(owner), mode], { env: { ...process.env, JWT_SECRET: 'isolated-process-secret' }, stdio: ['ignore','ignore','pipe','ipc'] });
    children.push(child);
    const messages: any[] = [], listeners: (() => void)[] = [];
    child.on('message', message => { messages.push(message); listeners.splice(0).forEach(fn => fn()); });
    const next = async (event: string): Promise<any> => {
      // A killed process can retain an open server transaction until MongoDB's
      // transaction lifetime expires. Allow the real server to release it.
      const timeout = setTimeout(() => { child.kill(); }, 120000);
      try {
        while (!messages.some(message => message.event === event)) {
          await new Promise<void>((resolve, reject) => { listeners.push(resolve); child.once('exit', code => reject(Error(`Worker exited before ${event}: ${code}`))); });
        }
        return messages.find(message => message.event === event);
      } finally { clearTimeout(timeout); }
    };
    return { child, next, go: () => child.send('continue') };
  }
  beforeEach(async () => {
    db = await createConnection(process.env.PQ_TEST_REPLICA_URI!, { dbName: `pq_process_${randomBytes(12).toString('hex')}` }).asPromise(); owner = new Types.ObjectId();
    await db.collection('users').insertOne({ _id: owner, email: 'synthetic@example.test', isActive: true, deletedAt: null, purgingAt: null, passwordHash: await bcrypt.hash('synthetic', 4) });
    await db.collection('account_lifecycle').insertOne({ _id: owner, status: 'active', generation: 0, writeVersion: 0 });
  });
  afterEach(async () => { for (const child of children.splice(0)) if (child.exitCode === null) child.kill(); if (db) { if (/^pq_process_[a-f0-9]{24}$/.test(db.name)) await db.dropDatabase(); await db.close(); } });
  it.each([false,true])('rejects delayed independent writer after deletion (recovery=%s)', async recover => {
    const writer = start('write'); await writer.next('ready');
    expect(await start('delete').next('done')).toMatchObject({ success: true });
    if (recover) expect(await start('recover').next('done')).toMatchObject({ success: true });
    writer.go(); expect(await writer.next('done')).toMatchObject({ success: false });
    expect(await db.collection('settings').countDocuments({ userId: owner })).toBe(0);
  });
  it('deduplicates simultaneous usage reservations in independent processes', async () => {
    const a = start('usage'), b = start('usage'); await Promise.all([a.next('ready'),b.next('ready')]); a.go(); b.go();
    const outcomes = await Promise.all([a.next('done'), b.next('done')]); expect(outcomes.filter(r=>r.success)).toHaveLength(1);
    expect(await db.collection('food_scan_usage').countDocuments({ userId: owner })).toBe(1);
  });
  it('invalidates an independently claimed worker before result persistence', async () => {
    await db.collection('analysis_jobs').insertOne({ userId: owner, generation: 0, status: 'pending', createdAt: new Date(), payload: { userId: String(owner), resourceId: String(new Types.ObjectId()) } });
    const worker = start('worker'); await worker.next('ready'); await start('delete').next('done'); worker.go(); await worker.next('done');
    expect(await db.collection('analysis_results').countDocuments({ userId: owner })).toBe(0);
    expect(await db.collection('analysis_jobs').findOne({ userId: owner })).toMatchObject({ status: 'running' });
  });
  it('resumes purge after process death at the external-cleanup boundary', async () => {
    await db.collection('settings').insertOne({ userId: owner, values: { synthetic: true } });
    await start('delete').next('done'); await db.collection('users').updateOne({ _id: owner }, { $set: { purgeAfter: new Date(0) } });
    const interrupted = start('crash-purge'); await interrupted.next('purging');
    expect(await db.collection('account_lifecycle').findOne({ _id: owner })).toMatchObject({ status: 'deleting' });
    expect(await start('recover').next('done')).toMatchObject({ success: false });
    expect(await start('purge').next('done')).toMatchObject({ success: true });
    expect(await db.collection('settings').countDocuments({ userId: owner })).toBe(0);
    expect(await db.collection('account_lifecycle').findOne({ _id: owner })).toMatchObject({ status: 'deleted' });
  });
  it('rolls back a process death inside the deletion transition', async () => {
    await start('crash-transition').next('interrupted');
    expect(await db.collection('account_lifecycle').findOne({ _id: owner })).toMatchObject({ status: 'active', generation: 0 });
    expect(await db.collection('users').findOne({ _id: owner })).toMatchObject({ isActive: true, deletedAt: null });
    expect(await start('delete').next('done')).toMatchObject({ success: true });
  }, 150000);
  it.each(['crash-postpurge','crash-finalize'])('resumes after %s without reactivating or recreating user data', async mode => {
    await db.collection('settings').insertOne({ userId: owner, values: {} });
    await start('delete').next('done'); await db.collection('users').updateOne({ _id: owner }, { $set: { purgeAfter: new Date(0) } });
    await start(mode).next('interrupted');
    expect(await db.collection('settings').countDocuments({ userId: owner })).toBe(0);
    expect(await db.collection('account_lifecycle').findOne({ _id: owner })).toMatchObject({ status: 'deleting' });
    expect(await start('purge').next('done')).toMatchObject({ success: true });
    expect(await db.collection('users').countDocuments({ _id: owner })).toBe(0);
    expect(await db.collection('account_lifecycle').findOne({ _id: owner })).toMatchObject({ status: 'deleted' });
  }, 150000);
  it.each(['settings','progress_entries','notifications', 'push_devices'])('resumes purge after process death while deleting %s', async collection => {
    await db.collection(collection).insertOne({ userId: owner });
    await start('delete').next('done'); await db.collection('users').updateOne({ _id: owner }, { $set: { purgeAfter: new Date(0) } });
    await start(`crash-purge:${collection}`).next('interrupted');
    expect(await db.collection(collection).countDocuments({ userId: owner })).toBe(0);
    expect(await db.collection('account_lifecycle').findOne({ _id: owner })).toMatchObject({ status: 'deleting' });
    expect(await start('purge').next('done')).toMatchObject({ success: true });
    expect(await db.collection('account_lifecycle').findOne({ _id: owner })).toMatchObject({ status: 'deleted' });
    for (const name of ['settings','progress_entries','notifications','push_devices']) expect(await db.collection(name).countDocuments({ userId: owner })).toBe(0);
  }, 150000);
  it('recovers an object written before process death at the external-file-creation boundary', async () => {
    const dir = join(process.cwd(), '.data', 'crash-storage', randomBytes(8).toString('hex'));
    process.env.STORAGE_LOCAL_DIR = dir;
    try {
      await start('crash-file-create').next('interrupted');
      const record = await db.collection('storage_uploads').findOne({ userId: owner });
      expect(record).toMatchObject({ status: 'pending' });
      expect(existsSync(join(dir, record!.key))).toBe(true);
      expect(await db.collection('storage_cleanup').countDocuments()).toBe(1);
      await start('delete').next('done'); await db.collection('users').updateOne({ _id: owner }, { $set: { purgeAfter: new Date(0) } });
      expect(await start('purge-storage').next('done')).toMatchObject({ success: true });
      expect(await db.collection('storage_uploads').countDocuments({ userId: owner })).toBe(0);
      expect(existsSync(join(dir, record!.key))).toBe(false);
      expect(await db.collection('account_lifecycle').findOne({ _id: owner })).toMatchObject({ status: 'deleted' });
    } finally { delete process.env.STORAGE_LOCAL_DIR; rmSync(dir, { recursive: true, force: true }); }
  }, 150000);
  it.each(['crash-worker','crash-completed'])('restarts after %s without repeating provider work', async mode => {
    await db.collection('analysis_jobs').insertOne({ userId: owner, generation: 0, status: 'pending', createdAt: new Date(), payload: { userId: String(owner), resourceId: String(new Types.ObjectId()) } });
    await start(mode).next('interrupted');
    await db.collection('analysis_jobs').updateMany({ status: 'running' }, { $set: { lockedUntil: new Date(0) } });
    expect(await start('restart-worker').next('done')).toMatchObject({ success: true });
    const completed = mode === 'crash-completed';
    expect(await db.collection('analysis_jobs').findOne({ userId: owner })).toMatchObject({ status: completed ? 'completed' : 'failed' });
    expect(await db.collection('analysis_results').countDocuments({ userId: owner })).toBe(completed ? 1 : 0);
    expect(await db.collection('food_scan_usage').countDocuments({ userId: owner })).toBe(1);
  });
});
