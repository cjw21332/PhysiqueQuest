// Generates a reviewable migration fragment from built schemas; never connects to MongoDB.
import 'reflect-metadata';
import { writeFile } from 'node:fs/promises';
import { indexes } from '../migrations/001-auth-query-indexes.mjs';
const modules = [
  ['auth/schemas/user.schema', 'UserSchema'], ['auth/schemas/sign-in-event.schema', 'SignInEventSchema'],
  ['auth/auth-rate-limit.schema', 'AuthRateLimitSchema'], ['auth/recovery-token.schema', 'RecoveryTokenSchema'],
  ['profile/schemas/profile.schema', 'ProfileSchema'], ['nutrition/schemas/nutrition.schema', 'NutritionSchema'],
  ['settings/schemas/settings.schema', 'SettingsSchema'], ['activity/schemas/activity.schema', 'ActivitySchema'],
  ['notifications/schemas/notification.schema', 'NotificationsSchema'], ['workouts/schemas/workout-session.schema', 'WorkoutSessionSchema'],
  ['progress/schemas/progress-entry.schema', 'ProgressEntrySchema'], ['leaderboard/schemas/leaderboard-snapshot.schema', 'LeaderboardSnapshotSchema'],
  ['coach/coach-program.schema', 'CoachProgramSchema'], ['safety/schemas/alert-event.schema', 'AlertEventSchema'],
  ['exercises/schemas/exercise.schema', 'ExerciseRecordSchema'],
];
const additions = [];
for (const [path, name] of modules) {
  const schema = (await import(`../dist/${path}.js`))[name];
  if (!schema) throw Error(`Missing ${name}`);
  const collection = schema.options.collection;
  if (!collection) throw Error(`Missing collection for ${name}`);
  for (const [key, sourceOptions] of schema.indexes()) {
    if ([...indexes, ...additions].some(index => index.collection === collection && JSON.stringify(index.key) === JSON.stringify(key))) continue;
    const options = Object.fromEntries(Object.entries(sourceOptions).filter(([field]) => ['unique', 'partialFilterExpression', 'expireAfterSeconds', 'sparse', 'collation'].includes(field)));
    additions.push({ collection, key, name: sourceOptions.name || Object.entries(key).map(([field, direction]) => `${field}_${direction}`).join('_'), options });
  }
}
await writeFile('index-snapshot.json', JSON.stringify(additions, null, 2));
console.log(`Review ${additions.length} missing schema index definitions in index-snapshot.json`);
