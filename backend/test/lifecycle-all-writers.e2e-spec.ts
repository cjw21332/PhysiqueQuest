import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { createConnection, Types, type Connection } from 'mongoose';
import { Settings, SettingsSchema } from '../src/settings/schemas/settings.schema.js';
import { SettingsService } from '../src/settings/settings.service.js';
import { Notifications, NotificationsSchema } from '../src/notifications/schemas/notification.schema.js';
import { NotificationsService } from '../src/notifications/notifications.service.js';
import { ProgressEntry, ProgressEntrySchema } from '../src/progress/schemas/progress-entry.schema.js';
import { ProgressService } from '../src/progress/progress.service.js';
import { WorkoutSession, WorkoutSessionSchema } from '../src/workouts/schemas/workout-session.schema.js';
import { WorkoutsService } from '../src/workouts/workouts.service.js';
import { PrivacyService } from '../src/privacy/privacy.service.js';
import { FoodScanUsageService } from '../src/foodscan/foodscan-usage.service.js';
import { AnalysisJobsService } from '../src/jobs/analysis-jobs.service.js';
import { StorageService } from '../src/storage/storage.service.js';
import { consumeQuota } from '../src/privacy/lifecycle-quota.js';
import { lifecycleContext } from '../src/privacy/lifecycle-context.js';
import { assertLifecycleReadiness } from '../src/privacy/lifecycle-readiness.js';
import { AccountLifecycleFence } from '../src/privacy/account-lifecycle-fence.js';
import { AuthService } from '../src/auth/auth.service.js';
import { User, UserSchema } from '../src/auth/schemas/user.schema.js';
import { SignInEvent, SignInEventSchema } from '../src/auth/schemas/sign-in-event.schema.js';
import { SessionService } from '../src/auth/session.service.js';
import { AuthSession, AuthSessionSchema } from '../src/auth/session.schema.js';
import { ChatRateLimitGuard } from '../src/chat/chat-rate-limit.guard.js';

const uri = process.env.PQ_TEST_REPLICA_URI;
function barrier() { let enter!: () => void, release!: () => void; return { entered: new Promise<void>(r => { enter = r; }), gate: new Promise<void>(r => { release = r; }), enter: () => enter(), release: () => release() }; }
describe.skipIf(!uri)('actual lifecycle application writers', () => {
  let connection: Connection, owner: Types.ObjectId, userId: string, privacy: PrivacyService;
  let settings: SettingsService, notifications: NotificationsService, progress: ProgressService, workouts: WorkoutsService, usage: FoodScanUsageService;
  beforeEach(async () => {
    process.env.JWT_SECRET = 'isolated-lifecycle-test-secret';
    connection = await createConnection(uri!, { dbName: `pq_all_writers_${randomBytes(12).toString('hex')}` }).asPromise();
    owner = new Types.ObjectId(); userId = String(owner);
    await connection.collection('users').insertOne({ _id: owner, email: 'synthetic@example.test', isActive: true, deletedAt: null, purgingAt: null, passwordHash: await bcrypt.hash('synthetic', 4) });
    await connection.collection('account_lifecycle').insertOne({ _id: owner, status: 'active', writeVersion: 0, generation: 0 });
    settings = new SettingsService(connection.model(Settings.name, SettingsSchema));
    notifications = new NotificationsService(connection.model(Notifications.name, NotificationsSchema));
    progress = new ProgressService(connection.model(ProgressEntry.name, ProgressEntrySchema));
    workouts = new WorkoutsService(connection.model(WorkoutSession.name, WorkoutSessionSchema));
    usage = new FoodScanUsageService(connection);
    privacy = new PrivacyService(connection, { deleteUserObjects: async () => 0 } as never);
    await Promise.all(Object.values(connection.models).map(model => model.init()));
  });
  afterEach(async () => { if (connection) { if (/^pq_all_writers_[a-f0-9]{24}$/.test(connection.name)) await connection.dropDatabase(); await connection.close(); } });
  async function purge() { await privacy.requestDeletion(userId, 'synthetic'); await connection.collection('users').updateOne({ _id: owner }, { $set: { purgeAfter: new Date(0) } }); await privacy.purgeUser(userId); }
  const notification = { icon: 'bell', title: 'Test', subtitle: '', body: 'Synthetic', time: 'now', group: 'Today', unread: true };
  const actions = {
    settings: () => settings.update(userId, { values: { darkMode: true } }),
    notification: () => notifications.add(userId, notification),
    notificationUpsert: () => notifications.get(userId),
    progress: () => progress.add(userId, { metric: 'weight', value: 75, unit: 'kg', measuredAt: new Date().toISOString() }),
    workout: () => workouts.create(userId, { exerciseIds: ['press'], startedAt: new Date().toISOString() }),
    usage: () => usage.begin(userId, 'same-request', 'test-model'),
    quota: async () => consumeQuota(connection, userId, [{ id: 'test-bucket', owned: true, expiresAt: new Date(Date.now()+60000) }], await new AccountLifecycleFence(connection).generation(userId)),
  };
  for (const name of Object.keys(actions) as (keyof typeof actions)[]) {
    it(`${name}: active write succeeds, purged account cannot recreate records`, async () => {
      await actions[name](); await purge(); await expect(actions[name]()).rejects.toThrow();
      for (const { name: collection } of await connection.db!.listCollections().toArray()) {
        if (['account_lifecycle','audit_logs','background_jobs'].includes(collection)) continue;
        expect(await connection.db!.collection(collection).countDocuments({ userId: owner })).toBe(0);
      }
    });
    it(`${name}: delayed request retains its original generation across recovery`, async () => {
      await privacy.requestDeletion(userId, 'synthetic'); await privacy.recover('synthetic@example.test', 'synthetic');
      await expect(lifecycleContext.run({ userId, generation: 0 }, actions[name])).rejects.toThrow();
      await actions[name]();
    });
  }
  it('reconciliation leaves deleting and legacy reservations untouched', async () => {
    const id = await usage.begin(userId, 'stale', 'test');
    await connection.db!.collection('food_scan_usage').updateOne({ _id: id as never }, { $set: { createdAt: new Date(0) } });
    await privacy.requestDeletion(userId, 'synthetic');
    await usage.maintain();
    expect(await connection.db!.collection('food_scan_usage').findOne({ _id: id as never })).toMatchObject({ status: 'pending' });
    await privacy.recover('synthetic@example.test', 'synthetic');
    await usage.maintain();
    expect(await connection.db!.collection('food_scan_usage').findOne({ _id: id as never })).toMatchObject({ status: 'pending' });
  });
  it('worker claimed before deletion cannot commit success or failure afterward', async () => {
    const gate = barrier(), uploadId = String(new Types.ObjectId());
    const scanner = { analyze: async () => { gate.enter(); await gate.gate; return { items: [] }; } };
    const storage = { download: async () => ({}), analysisInput: async () => ({}), markAnalyzed: async () => {} };
    const jobs = new AnalysisJobsService(connection, storage as never, scanner as never, usage, { value: { gemini: { model: 'test' } } } as never);
    const job = await jobs.enqueue(userId, uploadId);
    const running = jobs.tick(); await gate.entered;
    expect(await connection.collection('analysis_jobs').findOne({ _id: new Types.ObjectId(job.id) })).toMatchObject({ status: 'running' });
    await purge(); gate.release(); await running;
    await jobs.tick();
    expect(await connection.collection('analysis_jobs').countDocuments({ userId: owner })).toBe(0);
    expect(await connection.collection('analysis_results').countDocuments({ userId: owner })).toBe(0);
  });
  it('worker restart never replays an ambiguous paid request or a legacy job', async () => {
    const jobs = new AnalysisJobsService(connection, {} as never, { analyze: () => { throw Error('Must not replay'); } } as never, usage, {} as never);
    await connection.collection('analysis_jobs').insertMany([
      { userId: owner, generation: 0, status: 'running', lockedUntil: new Date(0) },
      { userId: owner, status: 'pending' },
    ]);
    await jobs.tick();
    expect(await connection.collection('analysis_jobs').findOne({ generation: 0 })).toMatchObject({ status: 'failed', code: 'ANALYSIS_INTERRUPTED' });
    expect(await connection.collection('analysis_jobs').findOne({ generation: { $exists: false } })).toMatchObject({ status: 'pending' });
  });
  it('a login paused during password verification cannot modify a recovered account', async () => {
    const auth = new AuthService(connection.model(User.name, UserSchema), connection.model(SignInEvent.name, SignInEventSchema), { sign: () => 'unused' } as never);
    const gate = barrier(), compare = bcrypt.compare.bind(bcrypt);
    const spy = vi.spyOn(bcrypt, 'compare').mockImplementation((async (password: string, hash: string) => {
      if (password === 'delayed-attempt') { gate.enter(); await gate.gate; return false; }
      return compare(password, hash);
    }) as never);
    try {
      const login = auth.login({ email: 'synthetic@example.test', password: 'delayed-attempt' });
      const rejected = expect(login).rejects.toThrow();
      await gate.entered; await privacy.requestDeletion(userId, 'synthetic'); await privacy.recover('synthetic@example.test', 'synthetic');
      gate.release(); await rejected;
      expect(await connection.collection('users').findOne({ _id: owner })).toMatchObject({ failedLoginAttempts: 0 });
      expect(await connection.collection('sign_in_events').countDocuments({ userId: owner })).toBe(0);
    } finally { spy.mockRestore(); }
  });
  it('session issuance rejects a principal authenticated before account recovery', async () => {
    const users = connection.model(User.name, UserSchema);
    const sessions = new SessionService(connection.model(AuthSession.name, AuthSessionSchema), users, { sign: () => 'synthetic' } as never);
    const oldUser = await users.findById(owner);
    await privacy.requestDeletion(userId, 'synthetic'); await privacy.recover('synthetic@example.test', 'synthetic');
    await expect(sessions.issue(oldUser!)).rejects.toThrow('Session expired');
    expect(await connection.collection('auth_sessions').countDocuments({ userId: owner })).toBe(0);
    await expect(sessions.issue((await users.findById(owner))!)).resolves.toHaveProperty('access_token');
  });
  it('quota guards reject the authenticated old generation before interceptors run', async () => {
    const guard = new ChatRateLimitGuard({ db: connection } as never);
    await privacy.requestDeletion(userId, 'synthetic'); await privacy.recover('synthetic@example.test', 'synthetic');
    const context = { switchToHttp: () => ({ getRequest: () => ({ user: { userId, lifecycleGeneration: 0 }, ip: '127.0.0.1' }), getResponse: () => ({ setHeader: () => {} }) }) };
    await expect(guard.canActivate(context as never)).rejects.toThrow();
    expect(await connection.collection('auth_rate_limits').countDocuments()).toBe(0);
  });
  it('a worker paused loading media cannot reserve usage under a recovered generation', async () => {
    const gate = barrier(), analyze = vi.fn();
    const jobs = new AnalysisJobsService(connection, { download: async () => ({}), analysisInput: async () => { gate.enter(); await gate.gate; return {}; } } as never, { analyze } as never, usage, { value: { gemini: { model: 'test' } } } as never);
    const uploadId = String(new Types.ObjectId()); await jobs.enqueue(userId, uploadId);
    const running = jobs.tick(); await gate.entered; await privacy.requestDeletion(userId, 'synthetic'); await privacy.recover('synthetic@example.test', 'synthetic');
    gate.release(); await running;
    expect(analyze).not.toHaveBeenCalled();
    expect(await connection.collection('food_scan_usage').countDocuments({ userId: owner })).toBe(0);
    await expect(jobs.enqueue(userId, uploadId)).rejects.toThrow('earlier account session');
  });
  it('upload verification delayed at external storage cannot recreate metadata after purge', async () => {
    const storage = new StorageService(connection), gate = barrier();
    const bytes = Buffer.from('89504e470d0a1a0a00000000', 'hex');
    Object.defineProperty(storage, 'provider', { value: { uploadUrl: async () => 'synthetic', read: async () => { gate.enter(); await gate.gate; return bytes; }, delete: async () => {} } });
    const upload = await storage.createUpload(userId, 'image/png', bytes.length);
    const pending = storage.verify(upload.id, userId); await gate.entered; await purge(); gate.release();
    await expect(pending).rejects.toThrow();
    expect(await connection.collection('storage_uploads').countDocuments({ userId: owner })).toBe(0);
    expect(await connection.collection('storage_cleanup').countDocuments()).toBe(1);
  });
  it('startup rejects an unmigrated account and accepts a migrated replica database', async () => {
    await assertLifecycleReadiness(connection);
    await connection.collection('account_lifecycle').deleteOne({ _id: owner });
    await expect(assertLifecycleReadiness(connection)).rejects.toThrow('migration');
    await expect(settings.update(userId, { values: {} })).rejects.toThrow();
  });
  it('transaction rollback leaves neither settings nor a fence increment committed', async () => {
    await expect(new AccountLifecycleFence(connection).withActiveWrite(userId, async session => {
      await connection.collection('settings').insertOne({ userId: owner }, { session }); throw Error('rollback');
    })).rejects.toThrow('rollback');
    expect(await connection.collection('settings').countDocuments()).toBe(0);
    expect(await connection.collection('account_lifecycle').findOne({ _id: owner })).toMatchObject({ writeVersion: 0 });
  });
  it('retries a transient transaction failure without leaving partial user data', async () => {
    let attempts = 0;
    await new AccountLifecycleFence(connection).withActiveWrite(userId, async session => {
      await connection.collection('settings').insertOne({ userId: owner }, { session });
      if (++attempts === 1) {
        const { MongoServerError } = await import('mongodb');
        const error = new MongoServerError({ message: 'synthetic transient conflict', code: 112 });
        error.addErrorLabel('TransientTransactionError'); throw error;
      }
    });
    expect(attempts).toBe(2);
    expect(await connection.collection('settings').countDocuments({ userId: owner })).toBe(1);
  });
  it('repeated deletion requests are idempotent and retain the first deadline', async () => {
    const first = await privacy.requestDeletion(userId, 'synthetic');
    expect(await privacy.requestDeletion(userId, 'synthetic')).toEqual(first);
    expect(await connection.collection('account_lifecycle').findOne({ _id: owner })).toMatchObject({ generation: 1 });
  });
  it('old reminder schedule stays invalid after recovery until explicitly saved again', async () => {
    await notifications.setReminder(userId, { enabled: true, hour: 12, minute: 0, timezone: 'UTC' });
    await privacy.requestDeletion(userId, 'synthetic'); await privacy.recover('synthetic@example.test', 'synthetic');
    await notifications.sendReminders(new Date('2026-11-15T12:00:00Z'));
    expect((await notifications.get(userId))!.items).toHaveLength(0);
    await notifications.setReminder(userId, { enabled: true, hour: 12, minute: 0, timezone: 'UTC' });
    await notifications.sendReminders(new Date('2026-11-15T12:00:00Z'));
    expect((await notifications.get(userId))!.items).toHaveLength(1);
  });
  it('cleanup retries object deletion after metadata purge and a late external upload', async () => {
    const storage = new StorageService(connection); let objectExists = true, fail = true;
    Object.defineProperty(storage, 'provider', { value: { uploadUrl: async () => 'synthetic', delete: async () => { if (fail) throw Error('synthetic storage outage'); objectExists = false; } } });
    await storage.createUpload(userId, 'image/png', 12);
    await connection.collection('storage_cleanup').updateMany({}, { $set: { runAt: new Date(0) } });
    await purge();
    await expect(storage.cleanup()).rejects.toThrow('outage');
    expect(await connection.collection('storage_cleanup').countDocuments()).toBe(1);
    fail = false; await storage.cleanup(); expect(objectExists).toBe(false);
    objectExists = true; await storage.cleanup(new Date(Date.now()+3600_001)); expect(objectExists).toBe(false);
  });
});
