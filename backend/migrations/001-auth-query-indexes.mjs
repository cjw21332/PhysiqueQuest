export const id = '001-auth-query-indexes';
export const indexes = [
  {"collection":"users","key":{"email":1},"name":"email_1","options":{"unique":true}},
  {"collection":"sign_in_events","key":{"userId":1},"name":"userId_1","options":{}},
  {"collection":"sign_in_events","key":{"userId":1,"occurredAt":-1},"name":"userId_1_occurredAt_-1","options":{}},
  {"collection":"sign_in_events","key":{"occurredAt":1},"name":"occurredAt_1","options":{}},
  {"collection":"auth_rate_limits","key":{"expiresAt":1},"name":"expiresAt_1","options":{"expireAfterSeconds":0}},
  {"collection":"password_recovery_tokens","key":{"userId":1},"name":"userId_1","options":{}},
  {"collection":"password_recovery_tokens","key":{"tokenHash":1},"name":"tokenHash_1","options":{"unique":true}},
  {"collection":"password_recovery_tokens","key":{"expiresAt":1},"name":"expiresAt_1","options":{"expireAfterSeconds":0}},
  {"collection":"password_recovery_tokens","key":{"requestId":1},"name":"requestId_1","options":{"unique":true,"partialFilterExpression":{"requestId":{"$type":"string"}}}},
  {"collection":"password_recovery_tokens","key":{"grantHash":1},"name":"grantHash_1","options":{"unique":true,"partialFilterExpression":{"grantHash":{"$type":"string"}}}},
  {"collection":"profiles","key":{"userId":1},"name":"userId_1","options":{"unique":true}},
  {"collection":"nutrition","key":{"userId":1},"name":"userId_1","options":{"unique":true}},
  {"collection":"settings","key":{"userId":1},"name":"userId_1","options":{"unique":true}},
  {"collection":"activity","key":{"userId":1},"name":"userId_1","options":{"unique":true}},
  {"collection":"notifications","key":{"userId":1},"name":"userId_1","options":{"unique":true}},
  {"collection":"workout_sessions","key":{"userId":1},"name":"userId_1","options":{}},
  {"collection":"workout_sessions","key":{"userId":1,"requestKey":1},"name":"userId_1_requestKey_1","options":{"unique":true,"partialFilterExpression":{"requestKey":{"$type":"string"}}}},
  {"collection":"workout_sessions","key":{"userId":1,"status":1,"endedAt":-1},"name":"userId_1_status_1_endedAt_-1","options":{}},
  {"collection":"workout_sessions","key":{"status":1,"endedAt":-1},"name":"status_1_endedAt_-1","options":{}},
  {"collection":"workout_sessions","key":{"userId":1,"startedAt":-1,"_id":-1},"name":"userId_1_startedAt_-1__id_-1","options":{}},
  {"collection":"workout_sessions","key":{"userId":1,"activityDate":1},"name":"userId_1_activityDate_1","options":{}},
  {"collection":"workout_sessions","key":{"userId":1,"scheduledDate":1},"name":"userId_1_scheduledDate_1","options":{}},
  {"collection":"workout_sessions","key":{"userId":1,"appliedRecordingIds":1},"name":"userId_1_appliedRecordingIds_1","options":{"unique":true,"partialFilterExpression":{"appliedRecordingIds":{"$type":"string"}}}},
  {"collection":"progress_entries","key":{"userId":1},"name":"userId_1","options":{}},
  {"collection":"leaderboard_snapshots","key":{"period":1,"boundaryKey":1},"name":"period_1_boundaryKey_1","options":{}},
  {"collection":"leaderboard_snapshots","key":{"period":1,"boundaryKey":1,"subjectId":1},"name":"period_1_boundaryKey_1_subjectId_1","options":{"unique":true}},
  {"collection":"coach_programs","key":{"userId":1,"contextHash":1},"name":"userId_1_contextHash_1","options":{"unique":true}},
  {"collection":"safety_alert_events","key":{"userId":1,"idempotencyKey":1},"name":"userId_1_idempotencyKey_1","options":{"unique":true}},
  {"collection":"safety_alert_events","key":{"userId":1,"createdAt":-1},"name":"userId_1_createdAt_-1","options":{}},
  {"collection":"admin_exercises","key":{"targetMuscle":1},"name":"targetMuscle_1","options":{}},
  {"collection":"admin_exercises","key":{"equipment":1},"name":"equipment_1","options":{}},
  {"collection":"admin_exercises","key":{"status":1,"pose":1},"name":"status_1_pose_1","options":{}},

  { collection: 'storage_uploads', key: { userId: 1 }, name: 'userId_1', options: {} },
  { collection: 'storage_uploads', key: { expiresAt: 1, status: 1 }, name: 'expiresAt_1_status_1', options: {} },
  { collection: 'analysis_jobs', key: { userId: 1, 'payload.resourceId': 1 }, name: 'userId_1_payload.resourceId_1', options: { unique: true } },
  { collection: 'analysis_jobs', key: { status: 1, createdAt: 1 }, name: 'status_1_createdAt_1', options: {} },
  { collection: 'analysis_jobs', key: { purgeAt: 1 }, name: 'purgeAt_1', options: { expireAfterSeconds: 0 } },
  { collection: 'analysis_results', key: { purgeAt: 1 }, name: 'purgeAt_1', options: { expireAfterSeconds: 0 } },
  { collection: 'email_verifications', key: { tokenHash: 1 }, name: 'tokenHash_1', options: { unique: true } },
  { collection: 'email_verifications', key: { expiresAt: 1 }, name: 'expiresAt_1', options: { expireAfterSeconds: 0 } },
  { collection: 'email_verifications', key: { userId: 1 }, name: 'userId_1', options: {} },
  { collection: 'push_devices', key: { userId: 1, deviceId: 1 }, name: 'userId_1_deviceId_1', options: { unique: true } },
  { collection: 'push_devices', key: { token: 1 }, name: 'token_1', options: { unique: true } },
  { collection: 'push_deliveries', key: { notificationId: 1, deviceId: 1 }, name: 'notificationId_1_deviceId_1', options: { unique: true } },
  { collection: 'push_deliveries', key: { status: 1, runAt: 1 }, name: 'status_1_runAt_1', options: {} },
  { collection: 'push_deliveries', key: { expiresAt: 1 }, name: 'expiresAt_1', options: { expireAfterSeconds: 0 } },
  { collection: 'auth_sessions', key: { purgeAt: 1 }, name: 'purgeAt_1', options: { expireAfterSeconds: 0 } },
  { collection: 'auth_sessions', key: { userId: 1 }, name: 'userId_1', options: {} },
  { collection: 'progress_entries', key: { userId: 1, metric: 1, measuredAt: -1 }, name: 'userId_1_metric_1_measuredAt_-1', options: {} },
  { collection: 'progress_entries', key: { userId: 1, measuredAt: -1 }, name: 'userId_1_measuredAt_-1', options: {} },
  { collection: 'users', key: { purgeAfter: 1 }, name: 'purgeAfter_1', options: {} },
  { collection: 'background_jobs', key: { key: 1 }, name: 'key_1', options: { unique: true } },
  { collection: 'background_jobs', key: { purgeAt: 1 }, name: 'purgeAt_1', options: { expireAfterSeconds: 0 } },
  { collection: 'background_jobs', key: { status: 1, runAt: 1, lockedUntil: 1 }, name: 'status_1_runAt_1_lockedUntil_1', options: {} },
  { collection: 'audit_logs', key: { purgeAt: 1 }, name: 'purgeAt_1', options: { expireAfterSeconds: 0 } },
  { collection: 'audit_logs', key: { actorId: 1, occurredAt: -1 }, name: 'actorId_1_occurredAt_-1', options: {} },
  { collection: 'audit_logs', key: { hotUntil: 1, cold: 1 }, name: 'hotUntil_1_cold_1', options: {} },
  { collection: 'audit_logs', key: { actorId: 1, action: 1 }, name: 'actorId_1_action_1', options: { unique: true, partialFilterExpression: { action: 'account_purged' } } },
];

export async function up(db) {
  const ledger = db.collection('schema_migrations');
  const previous = await ledger.findOne({ _id: id });
  if (previous?.status === 'complete') return;
  if (previous) throw Error('Migration is incomplete; review its recorded state before retrying');
  await ledger.insertOne({ _id: id, status: 'applying', createdIndexes: [], startedAt: new Date() });
  for (const index of indexes) {
    const collection = db.collection(index.collection);
    const exists = await db.listCollections({ name: index.collection }).hasNext();
    const current = exists ? await collection.listIndexes().toArray() : [];
    const existing = current.find(value => value.name === index.name);
    if (existing) {
      if (JSON.stringify(existing.key) !== JSON.stringify(index.key) || Boolean(existing.unique) !== Boolean(index.options.unique) || JSON.stringify(existing.partialFilterExpression) !== JSON.stringify(index.options.partialFilterExpression) || (index.options.expireAfterSeconds !== undefined && existing.expireAfterSeconds !== index.options.expireAfterSeconds)) throw Error('Existing index differs from migration definition');
      continue;
    }
    await collection.createIndex(index.key, { name: index.name, ...index.options });
    await ledger.updateOne({ _id: id }, { $push: { createdIndexes: { collection: index.collection, name: index.name } } });
  }
  await ledger.updateOne({ _id: id }, { $set: { status: 'complete', completedAt: new Date() } });
}

export async function down(db) {
  const ledger = db.collection('schema_migrations'), record = await ledger.findOne({ _id: id });
  if (!record) return;
  if (record.status !== 'complete') throw Error('Incomplete migration needs review before rollback');
  for (const index of record.createdIndexes) {
    const definition = indexes.find(value => value.collection === index.collection && value.name === index.name);
    if (!definition) throw Error('Unknown migration index');
    const current = (await db.collection(index.collection).listIndexes().toArray()).find(value => value.name === index.name);
    if (!current) continue;
    if (JSON.stringify(current.key) !== JSON.stringify(definition.key)) throw Error('Index changed since migration; refusing rollback');
    await db.collection(index.collection).dropIndex(index.name);
  }
  await ledger.deleteOne({ _id: id });
}
