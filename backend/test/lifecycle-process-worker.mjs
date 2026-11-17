import 'reflect-metadata';
import { createConnection, Types } from 'mongoose';
import { AccountLifecycleFence } from '../dist/privacy/account-lifecycle-fence.js';
import { lifecycleContext } from '../dist/privacy/lifecycle-context.js';
import { SettingsService } from '../dist/settings/settings.service.js';
import { Settings, SettingsSchema } from '../dist/settings/schemas/settings.schema.js';
import { PrivacyService } from '../dist/privacy/privacy.service.js';
import { FoodScanUsageService } from '../dist/foodscan/foodscan-usage.service.js';
import { AnalysisJobsService } from '../dist/jobs/analysis-jobs.service.js';
import { StorageService } from '../dist/storage/storage.service.js';

const [database, owner, mode] = process.argv.slice(2);
if (!/^pq_process_[a-f0-9]{24}$/.test(database)) throw Error('Isolated database required');
const connection = await createConnection(process.env.PQ_TEST_REPLICA_URI, { dbName: database }).asPromise();
const wait = () => new Promise(resolve => process.once('message', resolve));
const gate = async () => { const resumed = wait(); process.send({ event: 'ready' }); await resumed; };
const crash = event => { process.send({ event }, () => process.exit(13)); return new Promise(() => {}); };
// Interrupt only after a real database operation; production services and
// transactions remain intact. No simulated successful persistence.
const purgeCollection = mode.startsWith('crash-purge:') ? mode.slice('crash-purge:'.length) : undefined;
if (['crash-transition','crash-postpurge','crash-finalize'].includes(mode) || purgeCollection) {
  const collection = connection.db.collection.bind(connection.db);
  connection.db.collection = (...args) => {
    const target = collection(...args);
    return new Proxy(target, { get(object, key) {
      const value = object[key];
      if (typeof value !== 'function') return value;
      if (!['updateOne','deleteOne','deleteMany'].includes(key)) return value.bind(object);
      return async (...parameters) => {
        const result = await value.apply(object, parameters);
        if ((mode === 'crash-transition' && args[0] === 'account_lifecycle' && key === 'updateOne' && parameters[1]?.$set?.status === 'deleting') ||
            (mode === 'crash-postpurge' && args[0] === 'audit_logs' && key === 'updateOne') ||
            (mode === 'crash-finalize' && args[0] === 'users' && key === 'deleteOne') ||
            (purgeCollection && args[0] === purgeCollection && key === 'deleteMany' && result.deletedCount > 0)) await crash('interrupted');
        return result;
      };
    } });
  };
}
const storage = { deleteUserObjects: async () => { if (mode === 'crash-purge') { process.send({ event: 'purging' }); process.exit(13); } return 0; }, analysisInput: async () => ({}), markAnalyzed: async () => {} };
try {
  // Purge-by-storage must exercise the real object store, not the no-op stub.
  const privacy = new PrivacyService(connection, mode === 'purge-storage' ? new StorageService(connection) : storage);
  if (mode === 'write') {
    const generation = await new AccountLifecycleFence(connection).generation(owner);
    const settings = new SettingsService(connection.model(Settings.name, SettingsSchema));
    await gate(); await lifecycleContext.run({ userId: owner, generation }, () => settings.update(owner, { values: { synthetic: true } }));
  } else if (mode === 'delete' || mode === 'crash-transition') {
    await privacy.requestDeletion(owner, 'synthetic');
  } else if (mode === 'recover') {
    await privacy.recover('synthetic@example.test', 'synthetic');
  } else if (mode === 'usage') {
    await gate(); await new FoodScanUsageService(connection).begin(owner, 'duplicate', 'test');
  } else if (['worker','crash-worker','restart-worker','crash-completed'].includes(mode)) {
    const jobs = new AnalysisJobsService(connection, storage, { analyze: async () => {
      if (mode === 'crash-worker') await crash('interrupted');
      if (mode === 'restart-worker') throw Error('Provider must not be replayed');
      if (mode === 'worker') await gate(); return { items: [] };
    } }, new FoodScanUsageService(connection), { value: { gemini: { model: 'test' } } });
    await jobs.tick();
    if (mode === 'crash-completed') await crash('interrupted');
  } else if (['crash-purge','purge','crash-postpurge','crash-finalize'].includes(mode) || purgeCollection) {
    await privacy.purgeUser(owner);
  } else if (mode === 'crash-file-create') {
    // Real local object write, then process death before the lifecycle recheck.
    const storage = new StorageService(connection);
    const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const created = await storage.createUpload(owner, 'image/png', bytes.length);
    const record = await connection.db.collection('storage_uploads').findOne({ _id: new Types.ObjectId(created.id) });
    const write = storage.provider.write.bind(storage.provider);
    storage.provider.write = async (key, data) => { await write(key, data); await crash('interrupted'); };
    await storage.writeLocal(record.key, bytes);
  } else if (mode === 'purge-storage') {
    await privacy.purgeUser(owner);
  }
  process.send({ event: 'done', success: true });
} catch { process.send({ event: 'done', success: false }); }
finally { await connection.close(); process.disconnect(); }
