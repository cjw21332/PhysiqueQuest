import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { createConnection, Types, type Connection } from 'mongoose';
import { Activity, ActivitySchema } from '../src/activity/schemas/activity.schema.js';
import { ActivityService } from '../src/activity/activity.service.js';
import { CoachProgram, CoachProgramSchema } from '../src/coach/coach-program.schema.js';
import { CoachService } from '../src/coach/coach.service.js';
import { Profile, ProfileSchema } from '../src/profile/schemas/profile.schema.js';
import { ProfileService } from '../src/profile/profile.service.js';
import { PushDelivery, PushDevice, PushDeliverySchema, PushDeviceSchema } from '../src/push/push.schema.js';
import { PushService } from '../src/push/push.service.js';
import { Notifications, NotificationsSchema } from '../src/notifications/schemas/notification.schema.js';
import { AlertEvent, AlertEventSchema } from '../src/safety/schemas/alert-event.schema.js';
import { SafetyService } from '../src/safety/safety.service.js';
import { Settings, SettingsSchema } from '../src/settings/schemas/settings.schema.js';
import { User, UserSchema } from '../src/auth/schemas/user.schema.js';
import { PrivacyService } from '../src/privacy/privacy.service.js';
import { lifecycleContext } from '../src/privacy/lifecycle-context.js';

const uri = process.env.PQ_TEST_REPLICA_URI;
const expoToken = 'ExponentPushToken[synthetic-lifecycle-token]';

describe.skipIf(!uri)('remaining lifecycle application writers', () => {
  let connection: Connection, owner: Types.ObjectId, userId: string, privacy: PrivacyService;
  beforeEach(async () => {
    process.env.JWT_SECRET = 'isolated-remaining-writers-secret';
    connection = await createConnection(uri!, { dbName: `pq_remaining_writers_${randomBytes(12).toString('hex')}` }).asPromise();
    owner = new Types.ObjectId(); userId = String(owner);
    await connection.collection('users').insertOne({ _id: owner, email: 'synthetic@example.test', name: 'Synthetic', isActive: true, deletedAt: null, purgingAt: null, passwordHash: await bcrypt.hash('synthetic', 4) });
    await connection.collection('account_lifecycle').insertOne({ _id: owner, status: 'active', writeVersion: 0, generation: 0 });
    await connection.collection('profiles').insertOne({ userId: owner, name: 'Synthetic', age: '25', weight: '70', weightUnit: 'kg', height: '175', heightUnit: 'cm', gender: 'Other', goal: 'General fitness', equipment: ['barbell'], days: ['Monday', 'Wednesday', 'Friday'] });
    await Promise.all(Object.values(connection.models).map(model => model.init()));
    privacy = new PrivacyService(connection, { deleteUserObjects: async () => 0 } as never);
  });
  afterEach(async () => { if (connection) { if (/^pq_remaining_writers_[a-f0-9]{24}$/.test(connection.name)) await connection.dropDatabase(); await connection.close(); } });
  async function purge() { await privacy.requestDeletion(userId, 'synthetic'); await connection.collection('users').updateOne({ _id: owner }, { $set: { purgeAfter: new Date(0) } }); await privacy.purgeUser(userId); }
  function activity() {
    const users = connection.model(User.name, UserSchema);
    const nutrition = { read: async () => ({ meals: [], water: [] }) };
    const workouts = { creditHistory: async () => [], personalRecordDays: async () => [] };
    const leaderboard = { get: async () => null };
    const service = new ActivityService(connection.model(Activity.name, ActivitySchema), nutrition as never, workouts as never, leaderboard as never, users);
    return () => service.update(userId, { state: { timezone: 'UTC' } });
  }
  function profile() {
    const service = new ProfileService(connection.model(Profile.name, ProfileSchema));
    return () => service.update(userId, { name: 'Synthetic Updated' });
  }
  function push() {
    const service = new PushService(connection.model(PushDevice.name, PushDeviceSchema), connection.model(PushDelivery.name, PushDeliverySchema), connection.model(Notifications.name, NotificationsSchema));
    return () => service.register(userId, 'synthetic-device-0001', expoToken);
  }
  function safety() {
    const service = new SafetyService(connection.model(AlertEvent.name, AlertEventSchema), {} as never, {} as never, { isAvailable: () => false } as never, {} as never);
    return () => service.send(userId, { idempotencyKey: `synthetic-cancelled-${randomBytes(6).toString('hex')}`, eventType: 'cancelled' });
  }
  function coach() {
    const exercises = { getForPlan: async () => [{ _id: 'ex-1', name: 'Barbell Bench Press', group: 'Chest', targetMuscle: 'Chest', equipment: 'barbell', pose: 'bench', instructions: [], source: 'PhysiqueQuest' }] };
    const service = new CoachService(connection.model(Profile.name, ProfileSchema), connection.model(Settings.name, SettingsSchema), exercises as never, connection.model(CoachProgram.name, CoachProgramSchema));
    return () => service.getPlan(userId);
  }
  const writers = { activity, coach, profile, push, safety };
  for (const [name, factory] of Object.entries(writers)) {
    it(`${name}: active write succeeds and a purged account cannot recreate records`, async () => {
      const action = factory();
      await action();
      await purge();
      await expect(action()).rejects.toThrow();
      for (const { name: collection } of await connection.db!.listCollections().toArray()) {
        if (['account_lifecycle', 'audit_logs', 'background_jobs'].includes(collection)) continue;
        expect(await connection.db!.collection(collection).countDocuments({ userId: owner })).toBe(0);
      }
    });
    it(`${name}: delayed request retains its original generation across recovery`, async () => {
      const action = factory();
      await privacy.requestDeletion(userId, 'synthetic');
      await privacy.recover('synthetic@example.test', 'synthetic');
      await expect(lifecycleContext.run({ userId, generation: 0 }, action)).rejects.toThrow();
      await action();
    });
  }
});
