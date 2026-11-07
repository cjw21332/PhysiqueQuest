import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createConnection, type Connection } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { CatalogQuery, ExerciseDbService, normalizeExercise, SOURCE } from './exercisedb.service.js';

// Catalog collections are separate from the application's legacy exercises.
@Injectable()
export class CatalogSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CatalogSyncService.name);
  private db?: Connection;
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private stopping = false;
  private readonly owner = randomUUID();
  constructor(private readonly provider: ExerciseDbService) {}

  async onModuleInit() {
    const uri = process.env.EXERCISE_CATALOG_ENABLED === 'false' ? undefined :
      process.env.EXERCISE_CATALOG_MONGODB_URI || (process.env.NODE_ENV === 'test' ? undefined : process.env.MONGODB_URI);
    if (!uri) return;
    try {
      this.db = await createConnection(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 4 }).asPromise();
      const records = this.db.collection('exercisedb_catalog');
      await Promise.all([
        records.createIndex({ exerciseId: 1 }, { unique: true }),
        records.createIndex({ order: 1 }), records.createIndex({ name: 1 }),
        records.createIndex({ bodyParts: 1 }), records.createIndex({ equipments: 1 }),
        records.createIndex({ targetMuscles: 1 }), records.createIndex({ secondaryMuscles: 1 }),
      ]);
      this.provider.attachPersistent({ list: query => this.list(query), detail: id => this.detail(id) });
      this.timer = setInterval(() => { void this.tick().catch(() => this.logger.warn('Exercise catalog worker could not update its state.')); }, 1500);
      this.timer.unref();
      void this.tick().catch(() => this.logger.warn('Exercise catalog worker could not update its state.'));
    } catch (error) { this.logger.warn(`Exercise catalog storage unavailable: ${error instanceof Error ? error.message : 'connection failed'}`); }
  }

  async onModuleDestroy() { this.stopping = true; if (this.timer) clearInterval(this.timer); await this.db?.close(); }

  async tick() {
    if (!this.db || this.running || this.stopping) return;
    this.running = true;
    const state = this.db.collection('exercisedb_sync');
    try {
      await state.updateOne({ _id: 'catalog' } as any, { $setOnInsert: { status: 'pending', cursor: null, processed: 0, failures: 0 } }, { upsert: true });
      const now = new Date();
      const job = await state.findOneAndUpdate({ _id: 'catalog', $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lt: now } }], $and: [{ $or: [{ nextAttempt: { $exists: false } }, { nextAttempt: { $lte: now } }] }] } as any,
        { $set: { owner: this.owner, leaseUntil: new Date(Date.now() + 60000), status: 'syncing' } }, { returnDocument: 'after' });
      if (!job) return;
      const page = await this.provider.providerPage(job.cursor || undefined);
      if (typeof page.meta?.hasNextPage !== 'boolean' || (page.meta.hasNextPage && !page.rows.length)) throw new Error('Provider pagination metadata is incomplete');
      if (page.meta?.hasNextPage && (!page.meta.nextCursor || page.meta.nextCursor === job.cursor)) throw new Error('Provider cursor did not advance');
      const records = this.db.collection('exercisedb_catalog');
      const operations = page.rows.map((row, index) => {
        normalizeExercise(row); // Validate the whole page before advancing its cursor.
        return { updateOne: { filter: { exerciseId: row.exerciseId }, update: { $set: { ...row, order: Number(job.processed || 0) + index, syncedAt: new Date() } }, upsert: true } };
      });
      if (operations.length) await records.bulkWrite(operations, { ordered: false });
      const complete = !page.meta?.hasNextPage;
      if (complete && (!Number.isSafeInteger(page.meta?.total) || Number(page.meta?.total) < 0 || await records.countDocuments() !== page.meta?.total)) {
        throw new Error('Provider total does not match the synchronized catalog');
      }
      await state.updateOne({ _id: 'catalog', owner: this.owner } as any, { $set: {
        cursor: complete ? null : page.meta?.nextCursor, processed: complete ? 0 : Number(job.processed || 0) + page.rows.length,
        total: page.meta?.total ?? null, status: complete ? 'complete' : 'pending', failures: 0,
        nextAttempt: new Date(Date.now() + (complete ? 24 * 60 * 60 * 1000 : 1200)),
        ...(complete ? { lastSuccessfulSync: new Date() } : {}),
      }, $unset: { owner: '', leaseUntil: '' } });
    } catch (error) {
      this.logger.warn(`Exercise catalog page failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      const current = await state.findOne({ _id: 'catalog' } as any);
      const failures = Number(current?.failures || 0) + 1;
      const response = error && typeof error === 'object' && 'getResponse' in error && typeof error.getResponse === 'function' ? error.getResponse() as { retryAfter?: string } : undefined;
      const retryAfter = response?.retryAfter;
      const seconds = retryAfter ? Number(retryAfter) : NaN;
      const retryAt = Number.isFinite(seconds) ? Date.now() + Math.max(0, seconds) * 1000 : retryAfter ? Date.parse(retryAfter) : NaN;
      const delay = Math.max(Math.min(3600000, 5000 * 2 ** Math.min(failures, 9)), Number.isFinite(retryAt) ? retryAt - Date.now() : 0);
      await state.updateOne({ _id: 'catalog', owner: this.owner } as any, { $set: { status: 'failed', failures, nextAttempt: new Date(Date.now() + delay) }, $unset: { owner: '', leaseUntil: '' } });
    } finally { this.running = false; }
  }

  async status() {
    if (!this.db) return { status: 'unavailable' };
    const [state, count] = await Promise.all([this.db.collection('exercisedb_sync').findOne({ _id: 'catalog' } as any), this.db.collection('exercisedb_catalog').countDocuments()]);
    return { status: state?.status ?? 'pending', total: state?.total ?? null, count, failures: state?.failures ?? 0, lastSuccessfulSync: state?.lastSuccessfulSync ?? null };
  }

  async trackingCatalog() {
    if (!this.db) throw new Error('Exercise catalog storage is unavailable');
    return this.db.collection('exercisedb_catalog').find({}, { projection: { _id: 0 } }).sort({ exerciseId: 1 }).toArray();
  }
  async trackingRecord(id: string) {
    if (!this.db) throw new Error('Exercise catalog storage is unavailable');
    return this.db.collection('exercisedb_catalog').findOne({ exerciseId: id }, { projection: { _id: 0 } });
  }

  async filters() {
    if (!this.db) return { bodyParts: [], equipments: [], targetMuscles: [], secondaryMuscles: [] };
    const rows = this.db.collection('exercisedb_catalog');
    const [bodyParts, equipments, targetMuscles, secondaryMuscles] = await Promise.all(['bodyParts', 'equipments', 'targetMuscles', 'secondaryMuscles'].map(field => rows.distinct(field)));
    const clean = (values: unknown[]) => values.filter((value): value is string => typeof value === 'string').sort((a, b) => a.localeCompare(b));
    return { bodyParts: clean(bodyParts), equipments: clean(equipments), targetMuscles: clean(targetMuscles), secondaryMuscles: clean(secondaryMuscles) };
  }

  async list(query: CatalogQuery) {
    if (!this.db) return null;
    const records = this.db.collection('exercisedb_catalog');
    if (!(await records.estimatedDocumentCount())) return null;
    const filter: any = {};
    if (query.search?.trim()) {
      const safe = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = ['name', 'bodyParts', 'equipments', 'targetMuscles', 'secondaryMuscles', 'instructions'].map(field => ({ [field]: { $regex: safe, $options: 'i' } }));
    }
    if (query.muscle && query.muscle !== 'All') filter.bodyParts = { $in: ({ Chest: ['chest'], Back: ['back'], Legs: ['upper legs', 'lower legs'], Core: ['waist'], Shoulders: ['shoulders'], Arms: ['upper arms', 'lower arms'] } as Record<string, string[]>)[query.muscle] ?? [query.muscle.toLowerCase()] };
    if (query.equipment && !['Any equipment', 'All'].includes(query.equipment)) filter.equipments = { $in: ({ Dumbbells: ['dumbbell'], Bodyweight: ['bodyweight'], Machine: ['leverage machine', 'smith machine', 'sled machine', 'elliptical machine', 'stepmill machine', 'stationary bike'], 'Resistance bands': ['resistance band'], Barbell: ['barbell', 'olympic barbell', 'EZ bar', 'trap bar'], Cable: ['cable'], Kettlebell: ['kettlebell'] } as Record<string, string[]>)[query.equipment] ?? [query.equipment] };
    if (query.bodyPart) filter.$and = [{ bodyParts: query.bodyPart }];
    if (query.target) filter.targetMuscles = query.target;
    if (query.secondary) filter.secondaryMuscles = query.secondary;
    const page = Math.max(1, Math.floor(query.page || 1)), limit = Math.min(100, Math.max(1, Math.floor(query.limit || 12)));
    const sort: any = query.sort === 'name-asc' ? { name: 1, exerciseId: 1 } : query.sort === 'name-desc' ? { name: -1, exerciseId: 1 } : query.sort === 'body-part' ? { bodyParts: 1, name: 1, exerciseId: 1 } : query.sort === 'equipment' ? { equipments: 1, name: 1, exerciseId: 1 } : query.sort === 'recent' ? { syncedAt: -1, exerciseId: 1 } : { order: 1, exerciseId: 1 };
    const [total, rows, status] = await Promise.all([records.countDocuments(filter), records.find(filter).collation({ locale: 'en', strength: 2 }).sort(sort).skip((page - 1) * limit).limit(limit).toArray(), this.status()]);
    return { items: rows.map(row => normalizeExercise(row as any)), total, page, limit, pages: Math.ceil(total / limit), source: SOURCE, sync: status, coverageNote: status.status !== 'complete' ? 'Results include exercises synchronized so far.' : undefined };
  }

  async detail(id: string) {
    const row = await this.db?.collection('exercisedb_catalog').findOne({ exerciseId: id });
    return row ? normalizeExercise(row as any) : null;
  }
}
