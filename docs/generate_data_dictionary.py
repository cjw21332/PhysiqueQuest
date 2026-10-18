from pathlib import Path
import re
root=Path.cwd()
items=[
('users','auth/schemas/user.schema.ts','User','Accounts, login protection, and user/admin permissions.'),
('profiles','profile/schemas/profile.schema.ts','Profile','Personal details, training preferences, measurements, and emergency contact.'),
('settings','settings/schemas/settings.schema.ts','Settings','One preferences document per user, including nutrition targets.'),
('activity','activity/schemas/activity.schema.ts','Activity','One activity-state document per user; current writes retain timezone, while rewards are derived.'),
('nutrition','nutrition/schemas/nutrition.schema.ts','Nutrition','One nutrition document per user containing meal and water entries.'),
('notifications','notifications/schemas/notification.schema.ts','Notifications','One notification inbox document per user.'),
('workout_sessions','workouts/schemas/workout-session.schema.ts','WorkoutSession','Planned workouts, standalone sessions, and reviewed video recordings.'),
('progress_entries','progress/schemas/progress-entry.schema.ts','ProgressEntry','Individual dated body measurements or strength measurements.'),
('coach_programs','coach/coach-program.schema.ts','CoachProgram','Saved weekly program snapshots, versioned by training context.'),
('leaderboard_snapshots','leaderboard/schemas/leaderboard-snapshot.schema.ts','LeaderboardSnapshot','Historical standings for one user at one period boundary.'),
('safety_alert_events','safety/schemas/alert-event.schema.ts','AlertEvent','Safety alert requests, delivery status, optional location, and resolution.'),
('sign_in_events','auth/schemas/sign-in-event.schema.ts','SignInEvent','Successful registration/login events used by activity calculations.'),
('password_recovery_tokens','auth/recovery-token.schema.ts','RecoveryToken','Hashed recovery codes, expiration, and single-use tracking.'),
('auth_rate_limits','auth/auth-rate-limit.schema.ts','AuthRateLimit','Shared recovery rate limits and email cooldowns; no raw email/IP is stored.'),
('admin_exercises','exercises/schemas/exercise.schema.ts','ExerciseRecord','Shared administrator-managed catalog; separate from the external ExerciseDB library.')]
notes={
'_id':'SHA-256 digest of the limiter bucket or cooldown key; string primary key for auth_rate_limits.',
'sessionVersion':'User JWT revocation version, or its snapshot on a password-change token. Password updates increment the user version atomically; legacy missing user values are zero.',
'purpose':'Distinguishes public password-reset recovery from authenticated password-change authorization.',
'accountEmail':'Registered account email snapshot for password-change authorization; invalidated by an email change.',
'requestId':'Opaque request identifier bound to the code digest; partial unique index for strings.',
'attempts':'Verification guesses consumed atomically; service permits at most five.',
'verifiedAt':'When the request was exchanged for a reset grant; null before verification.',
'grantHash':'SHA-256 reset-grant digest; hidden by default, partial unique index for strings.',
'grantExpiresAt':'Reset grant expires five minutes after verification; original request expiry also applies.',
'hits':'Shared request count in this rate-limit bucket.',
'userId':'Owning account; intended link to users._id.', 'subjectId':'Ranked account; link to users._id.', 'email':'Login email, normalized to lowercase and trimmed.', 'name':'Display or descriptive name.', 'passwordHash':'Password hash; excluded from ordinary query selection.', 'isActive':'Whether the account is enabled.', 'role':'Access role.', 'failedLoginAttempts':'Number of failed login attempts.', 'lockoutUntil':'Time when a temporary login lockout ends.',
'age':'Profile age stored as text.', 'height':'Profile height stored as text.', 'heightInches':'Optional inches component of a feet-and-inches height.', 'heightUnit':'Unit used for profile height.', 'weight':'Profile weight stored as text.', 'weightUnit':'Unit used for profile weight.', 'gender':'Saved gender selection.', 'chest':'Optional chest measurement stored as text.', 'waist':'Optional waist measurement stored as text.', 'arms':'Optional arm measurement stored as text.', 'chestUnit':'Chest measurement unit.', 'waistUnit':'Waist measurement unit.', 'armsUnit':'Arm measurement unit.', 'measurementUnit':'Legacy shared measurement unit.', 'activity':'Saved activity-level selection.', 'goal':'Saved fitness goal.', 'targetWeight':'Optional target weight stored as text.', 'targetDate':'Optional target-date text.', 'seriousness':'Saved goal-commitment preference.', 'equipment':'Equipment label or saved equipment selections.', 'days':'Preferred training weekdays.', 'duration':'Preferred workout duration label.', 'conditions':'Saved health conditions used by planning filters.', 'healthNotes':'Additional user-entered health notes.', 'contactName':'Emergency-contact name; contact is not a separate user entity.', 'contactPhone':'Emergency-contact telephone number.', 'contactRelationship':'Relationship to the emergency contact.',
'values':'Flexible preference object; supported paths are documented below.', 'state':'Flexible activity object; timezone is persisted and historical fields may remain.', 'meals':'Embedded MealEntry objects.', 'water':'Embedded WaterEntry objects.', 'items':'Embedded NotificationItem objects.',
'exerciseIds':'String exercise identifiers; not database foreign keys to admin_exercises.', 'startedAt':'Session start timestamp.', 'endedAt':'Confirmed session finish timestamp.', 'pausedAt':'Start of the current pause; absent/null when running.', 'pausedSeconds':'Accumulated pause time, in seconds.', 'status':'Current workflow status.', 'durationSeconds':'Duration in seconds; for workouts, accumulated active session duration.', 'exerciseResults':'Legacy per-exercise totals.', 'exercises':'Exercise snapshots captured for this session.', 'sets':'Reviewed/manual set results.', 'appliedRecordingIds':'Server-assigned source recording IDs reserved by this planned workout.', 'revision':'Optimistic-concurrency version used to reject stale writes.', 'origin':'How the workout was created.', 'requestKey':'Idempotency key scoped to the user.', 'requestHash':'Hash used to verify matching retry payloads.', 'completionHash':'Hash used for idempotent completion.', 'programVersion':'Coach contextHash associated with this plan version; application-level link.', 'dayIndex':'Monday-based weekday index: 0 Monday through 6 Sunday.', 'scheduledDate':'Selected planned date in YYYY-MM-DD; anchors weekday progress.', 'timezone':'IANA timezone used for date calculations.', 'activityDate':'Performed/credited calendar-date key.', 'creditPolicyVersion':'Version of the workout-credit rules.',
'metric':'Kind of measurement.', 'value':'Numeric measurement amount.', 'unit':'Measurement unit.', 'measuredAt':'When the measurement was taken.', 'contextHash':'Training-context hash; unique together with userId.', 'plan':'Flexible saved program snapshot; important paths documented below.', 'period':'Leaderboard period label, such as week/month/all; schema stores a string.', 'boundaryKey':'Identifies the standings boundary within a period.', 'rank':'Recorded position, starting at 1.', 'points':'Recorded nonnegative score.',
'idempotencyKey':'Retry key unique per user.', 'eventType':'Manual alert, inactivity alert, or cancellation.', 'errorCode':'Optional delivery/processing failure code.', 'providerReference':'Optional external delivery reference.', 'occurredAt':'When the event occurred.', 'workoutSessionId':'Optional intended workout link; safety service does not verify target existence/ownership.', 'exerciseId':'Exercise string identifier.', 'location':'Optional embedded AlertLocation.', 'resolvedAt':'Time the alert was resolved.', 'flagged':'Administrative flag.', 'source':'How this record/result originated.',
'tokenHash':'HMAC-SHA256 digest bound to request ID and code; excluded from ordinary query selection.', 'expiresAt':'Record expiration timestamp; TTL cleanup is asynchronous and services also check expiry.', 'usedAt':'When the recovery token was consumed or invalidated, or null.', 'slug':'Human-readable catalog identifier; not declared unique.', 'group':'Exercise category.', 'pose':'Catalog pose-readiness label; not a measured form score.', 'targetMuscle':'Target-muscle label.', 'difficulty':'Difficulty label.', 'pictureUrl':'Exercise picture URL.', 'videoUrl':'Exercise video URL.', 'instructions':'Exercise instruction steps.', 'trackingStatus':'Catalog tracking-status label.',
'id':'Application identifier scoped to the parent data.', 'meal':'Meal category.', 'calories':'Energy in kilocalories.', 'detail':'Display detail or serving text.', 'time':'Display time text.', 'edited':'Whether the meal was edited.', 'protein':'Protein in grams.', 'carbs':'Carbohydrates in grams.', 'fat':'Fat in grams.', 'date':'Calendar-date key; use YYYY-MM-DD in application flows.', 'fdcId':'Optional USDA FoodData Central identifier.', 'confidence':'Food-identification confidence between 0 and 1.', 'estWeightG':'Estimated edible weight, in grams.', 'glasses':'Logged glass count for the date.',
'icon':'Notification icon identifier.', 'title':'Notification title.', 'subtitle':'Optional notification subtitle.', 'body':'Notification message.', 'group':'Grouping/category label.', 'unread':'Whether the notification is unread.', 'lat':'Latitude.', 'lng':'Longitude.', 'accuracyMeters':'Location accuracy, in meters.', 'capturedAt':'When the location was captured.', 'reps':'Repetition count.', 'loadKg':'Optional external load in kilograms.'}

def fields(path,cls):
 text=(root/'backend/src'/path).read_text(encoding='utf-8-sig')
 start=re.search(r'export class '+cls+r'\s*\{',text).end()
 # Stop at the next class/schema declaration; decorators may contain nested braces.
 end=re.search(r'\n(?:export const|@Schema|export class)',text[start:])
 body=text[start:start+end.start()] if end else text[start:]
 found=[]
 for m in re.finditer(r'@Prop\(',body):
  pos=m.end(); depth=1; quote=None; esc=False; i=pos
  while depth:
   c=body[i]
   if quote:
    if esc: esc=False
    elif c=='\\': esc=True
    elif c==quote: quote=None
   elif c in "'\"": quote=c
   elif c=='(': depth+=1
   elif c==')': depth-=1
   i+=1
  opts=body[pos:i-1]
  decl=re.match(r'\s*(\w+)(\?)?\s*:\s*([^;]+);',body[i:])
  assert decl,(path,body[i:i+70])
  name,opt,typ=decl.groups()
  if name in ['createdAt','updatedAt']: continue
  typ=typ.strip().replace('Types.ObjectId','ObjectId').replace('Record<string, unknown>','Mixed object').replace('Record<string, any>','Mixed object')
  if ' | ' in typ: typ='string' if "'" in typ else typ
  constraints=[]
  enum=re.search(r'enum:\s*\[([^]]+)\]',opts)
  if enum:
   constraints.append('Allowed: '+enum.group(1).replace("'",''))
   if typ in ['AlertEventType','AlertStatus']: typ='string'
  for key,label in [('min','Min'),('max','Max'),('maxlength','Max length')]:
   match=re.search(r'\b'+key+r':\s*([\d.]+)',opts)
   if match: constraints.append(label+' '+match.group(1))
  if 'unique: true' in opts: constraints.append('Unique')
  if 'lowercase: true' in opts: constraints.append('Lowercase')
  if 'trim: true' in opts: constraints.append('Trimmed')
  if 'select: false' in opts: constraints.append('Hidden by default')
  if 'expires: 0' in opts: constraints.append('TTL at expiresAt')
  default=re.search(r'default:\s*(\[\]|\{\}|undefined|null|true|false|\d+|\x27[^\x27]*\x27)',opts)
  presence='Required' if 'required: true' in opts else 'Not schema-required'
  if default: presence+='; default '+default.group(1)
  found.append((name,typ,presence,'; '.join(constraints) or '—',notes.get(name,'Stored application field.')))
 return found

def table(rows):
 out=['| Field | Type | Required / default | Constraints | Meaning |','|---|---|---|---|---|']
 for row in rows: out.append('| '+' | '.join('`'+str(x).replace('|',r'\|')+'`' if i<2 else str(x).replace('|',' / ') for i,x in enumerate(row))+' |')
 return '\n'.join(out)+'\n'
intro='''# PhysiqueQuest v2.7.4 — Data dictionary

Checked against the repository's active Mongoose schemas and workout contract on October 18, 2026. This is a source-code dictionary, not a live database inventory.

MongoDB calls these **collections**; they serve the role of tables. Each collection contains documents, and some documents contain embedded arrays. Embedded objects below are not separate database tables.

## Reading the dictionary

- **ObjectId**: MongoDB identifier. `_id` is the primary key of each top-level document.
- **Required** refers to Mongoose `required: true`, not only a TypeScript annotation. Requests and services may enforce additional rules.
- **Not schema-required** does not imply a field is unused. It may be defaulted or assigned by the service.
- **Mixed object**: flexible JSON-like content whose internal structure is controlled by application code.
- A `ref: User` is a Mongoose relationship declaration, not a database-enforced foreign key.
- String IDs in embedded records are application IDs, not independent MongoDB primary keys.

## Shared collection fields

Fourteen of the 15 active collections have these fields. The exception is `auth_rate_limits`, which uses a hashed string `_id`, `hits`, and TTL `expiresAt`, without timestamps or a version key. Mongoose can also maintain its internal `__v` version key elsewhere; it is not a substitute for the explicit workout `revision`.

| Field | Type | Meaning |
|---|---|---|
| `_id` | ObjectId | Unique primary key, generated by MongoDB/Mongoose. |
| `createdAt` | Date | Creation timestamp managed by Mongoose timestamps. |
| `updatedAt` | Date | Last-update timestamp managed by Mongoose timestamps. |

## Collection directory

| Collection | Purpose | User relationship |
|---|---|---|
'''
for name,path,cls,purpose in items:
 relation='Account entity' if name=='users' else 'Shared hashed buckets; no user reference' if name=='auth_rate_limits' else 'Shared catalog' if name=='admin_exercises' else '1 user → 0 or 1 document' if name in ['profiles','settings','activity','nutrition','notifications'] else '1 user → 0 or many documents'
 intro+=f'| [`{name}`](#{name}) | {purpose} | {relation} |\n'
intro+='\nA one-per-user record can be absent until the corresponding setup or first write occurs. “1 user → 0 or 1 profile” means a user may have no profile yet, and can have at most one profile.\n\n'
count=0
for name,path,cls,purpose in items:
 rows=fields(path,cls); count+=len(rows)
 intro+=f'## {name}\n\n{purpose}\n\nSource: [schema](../backend/src/{path}).\n\n'+table(rows)+'\n'
intro+='''## Embedded objects

These records live inside a parent document. Their Mongoose embedded schemas disable independent `_id` fields. WorkoutExercise and SetResult use generic object arrays, with their expected shape defined by the workout contract and request/service validation.

'''
for parent,path,cls in [('nutrition.meals[]','nutrition/schemas/nutrition.schema.ts','MealEntry'),('nutrition.water[]','nutrition/schemas/nutrition.schema.ts','WaterEntry'),('notifications.items[]','notifications/schemas/notification.schema.ts','NotificationItem'),('safety_alert_events.location','safety/schemas/alert-event.schema.ts','AlertLocation'),('workout_sessions.exerciseResults[]','workouts/schemas/workout-session.schema.ts','ExerciseResult')]:
 rows=fields(path,cls);count+=len(rows)
 intro+=f'### {cls} — `{parent}`\n\n'+table(rows)+'\n'
contract=(root/'backend/src/workouts/workout-contract.ts').read_text(encoding='utf-8')
extra={'setId':'Session-scoped set identifier, normally exerciseId:setIndex.', 'setIndex':'Zero-based planned set position.', 'sets':'Number of planned sets for this exercise.', 'prescription':'Human-readable target, such as 3 × 12 or 3 × 45 s.', 'trackingPresetId':'Optional local counting-rule identifier.', 'detectedReps':'Original detector estimate, separate from the reviewed reps.', 'side':'Body side used for local analysis.', 'algorithmVersion':'Local counting algorithm version.', 'clipDurationSeconds':'Analyzed clip duration in seconds.', 'sourceRecordingId':'Original reviewed recording workout ID; server assigns and preserves this provenance.', 'name':'Exercise name captured when the workout was created.', 'equipment':'Equipment description captured in the workout.'}
for cls,parent in [('WorkoutExercise','workout_sessions.exercises[]'),('SetResult','workout_sessions.sets[]')]:
 body=re.search(r'export type '+cls+r' = \{(.*?)\n\};',contract,re.S).group(1)
 rows=[]
 for name,opt,typ in re.findall(r'^  (\w+)(\?)?: ([^;]+);',body,re.M):
  constraint='Allowed: '+typ.replace("'",'').replace('|',',') if "'" in typ else '—'
  rows.append((name,'string' if "'" in typ else typ,'Optional in contract' if opt else 'Required in contract',constraint,extra.get(name,notes.get(name,'Stored application field.'))))
 intro+=f'### {cls} — `{parent}`\n\nSource: [workout contract](../backend/src/workouts/workout-contract.ts).\n\n'+table(rows)+'\n';count+=len(rows)
intro+='''## Important Mixed-object paths

These paths are application shapes, not separately registered collections or Mongoose child schemas.

| Path | Type / accepted values | Meaning |
|---|---|---|
| `settings.values.inactivity` | boolean | Enables native inactivity monitoring. |
| `settings.values.alarmVolume` | boolean | Enables the safety alarm sound setting. |
| `settings.values.threshold` | 30, 45, or 60 | Inactivity threshold in seconds, validated by the settings DTO. |
| `settings.values.showLeaderboard` | boolean | Leaderboard preference. |
| `settings.values.notifications` | boolean | Legacy notification preference. |
| `settings.values.nutritionTargets.calories` | integer, 1–10000 | Daily energy target in kilocalories. |
| `settings.values.nutritionTargets.protein` | integer, 0–1000 | Daily protein target in grams. |
| `settings.values.nutritionTargets.carbs` | integer, 0–2000 | Daily carbohydrate target in grams. |
| `settings.values.nutritionTargets.fats` | integer, 0–1000 | Daily fat target in grams; note plural `fats`, while meals use `fat`. |
| `activity.state.timezone` | IANA timezone string | Current persisted activity preference; service fallback is UTC. |
| `coach_programs.plan.goal` | string | Fitness goal used to build the saved program. |
| `coach_programs.plan.weekLabel` | string | Human-readable program/week label. |
| `coach_programs.plan.sessionCount` | number | Number of scheduled workout days. |
| `coach_programs.plan.duration` | string | Preferred duration label. |
| `coach_programs.plan.libraryReady` | boolean | Whether a suitable catalog selection was available. |
| `coach_programs.plan.sets` | string | Default prescription label. |
| `coach_programs.plan.days[]` | object array | Seven weekday entries with index, name, label, workout flag, title, focus, and exercise snapshots. |
| `coach_programs.plan.days[].exercises[]` | object array | Exercise ID, slug, GIF URL, instructions, name, category, muscle, equipment, tracking label, prescription, and form tip. |

The Coach response can add contextual metadata such as programVersion; the persistent version key is `coach_programs.contextHash`. Extra response metadata should not be mistaken for an independently declared database column.

## Keys, indexes, and relationship explanation

| Collection | Unique key beyond `_id` | Other declared indexes / notes |
|---|---|---|
| users | email | Normalized login identity. |
| profiles, settings, activity, nutrition, notifications | userId in each collection | At most one document of each kind per account. |
| coach_programs | userId + contextHash | Allows multiple program versions for one account. |
| workout_sessions | userId + requestKey, only where requestKey is a string | Also indexes user/status/end time, status/end time, user/start time/_id, user/activityDate, and user/scheduledDate. |
| workout_sessions | userId + appliedRecordingIds element, partial unique multikey index | Prevents a source recording from being applied to different planned workouts for the same user. |
| progress_entries | None | userId index. |
| leaderboard_snapshots | period + boundaryKey + subjectId | Also period + boundaryKey index. |
| safety_alert_events | userId + idempotencyKey | Also userId + createdAt index. |
| sign_in_events | None | userId, userId + occurredAt, and occurredAt indexes. |
| password_recovery_tokens | tokenHash; partial unique requestId and grantHash where strings | userId index and TTL expiry on expiresAt. |
| auth_rate_limits | Hashed string _id | TTL expiry on expiresAt; service checks expiry before reusing cooldown keys. |
| admin_exercises | None | targetMuscle, equipment, and status + pose indexes; slug is not unique. |

These are schema-declared indexes; their presence in a deployed database has not been checked here. TTL deletion happens asynchronously; application expiry checks remain necessary.

`coach_programs.userId` is an ObjectId ownership field without a Mongoose `ref`. Services still use it to find a user's programs; it does not mean programs are unowned. The optional safety `workoutSessionId` is stored without verifying the target workout. Exercise IDs are strings that can refer to external catalog entries or local counting presets, so they are not guaranteed matches to `admin_exercises._id`.

## Worked example: recording to planned set

A user records four push-ups and reviews the result. The recording is a `workout_sessions` document with origin `recorded-set`. Applying it to Monday's plan saves one result in that planned workout's `sets[]`, assigns `sourceRecordingId`, and reserves the recording in `appliedRecordingIds`. It completes one set, not four sets. `scheduledDate`, `dayIndex`, and `programVersion` keep that credit on the correct plan date. A zero-rep recording cannot be applied as a completed planned set.

Remaining sets are calculated from the exercise snapshots and unique set positions: total planned sets minus completed sets minus skipped sets. They are not an independently stored counter.

## Data that is not a collection

Session Start set state, unsaved reps/load, and pending-save drafts are account-scoped browser persistence. Session pause timestamps and accumulated pause time are server-backed workout fields. Videos, decoded frames, and pose landmarks used by the local counter are not saved in a dedicated database collection. XP, streaks, missions, badges, current rankings, and remaining-set counts are calculated from records rather than stored as separate tables.

The older unregistered `backend/src/exercise/exercise.schema.ts` is excluded. Its existence does not establish whether an older deployed database still has a legacy exercises collection.

See the [ERD](ERD.md) for cardinality diagrams and the [network layout](NETWORK_LAYOUT.md) for communication paths.
'''
(root/'docs/DATA_DICTIONARY.md').write_text(intro,encoding='utf-8')
assert len(items)==15
assert 'Stored application field.' not in intro
print(f'Created dictionary for 15 collections and 7 embedded shapes, {count} documented fields excluding shared timestamps/IDs.')
