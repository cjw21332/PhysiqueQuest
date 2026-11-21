#!/usr/bin/env node
/**
 * Generate PhysiqueQuest's ExerciseDB v1 tracking classification.
 *
 * Inputs are the real catalog (`ml/data/exercisedb_catalog.json`, 1500 rows) and
 * the runtime pattern definitions in `shared/exerciseEngine.ts`. Rules are
 * deterministic and auditable; nothing here is inferred from the old
 * `exercise_ml_map.json`, whose movement labels were equipment-hint guesses.
 *
 * Outputs:
 *   shared/exerciseTracking.generated.ts
 *   backend/src/pose-tracker/catalog-tracking.generated.ts
 *   output/exercisedb-v1-tracking-coverage.json
 *   EXERCISEDB_V1_TRACKING_COVERAGE.md
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(readFileSync(join(root, 'ml/data/exercisedb_catalog.json'), 'utf8'));
if (!Array.isArray(catalog) || catalog.length !== 1500) {
  throw new Error(`Expected the real 1500-row ExerciseDB v1 catalog, got ${catalog?.length}`);
}

const norm = (value) => String(value ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();

const PATTERNS = {
  chest_fly: { label: 'Chest fly', joints: 'elbow-shoulder-opposite shoulder', camera: 'front-oblique', count: 'bilateral shoulder horizontal adduction', form: 'none; perspective sensitive' },
  hip_abduction: { label: 'Hip abduction', joints: 'opposite hip-hip-knee', camera: 'front', count: 'bilateral hip abduction', form: 'none; pads may occlude hips' },
  squat: { label: 'Squat', joints: 'hip–knee–ankle', camera: 'side (front for knee tracking)', count: 'bilateral knee flexion/extension', form: 'knee-in screening (front view only)' },
  squat_hold: { label: 'Wall sit', joints: 'hip–knee–ankle', camera: 'side', count: 'isometric hold timer', form: 'none' },
  lunge: { label: 'Lunge / split squat', joints: 'hip–knee–ankle', camera: 'side', count: 'per-side knee flexion/extension', form: 'knee-past-toe screening' },
  hinge: { label: 'Hip hinge', joints: 'shoulder–hip–knee', camera: 'side', count: 'bilateral hip flexion/extension', form: 'spine-line screening' },
  hip_thrust: { label: 'Hip extension', joints: 'shoulder–hip–knee', camera: 'side', count: 'bilateral hip extension', form: 'none' },
  horizontal_push: { label: 'Horizontal push', joints: 'shoulder–elbow–wrist', camera: 'side', count: 'bilateral elbow flexion/extension', form: 'body-line screening' },
  vertical_push: { label: 'Overhead press', joints: 'shoulder–elbow–wrist', camera: 'front', count: 'bilateral elbow extension/flexion', form: 'torso-swing screening' },
  dip: { label: 'Dip', joints: 'shoulder–elbow–wrist', camera: 'side', count: 'bilateral elbow flexion/extension', form: 'none' },
  curl: { label: 'Elbow curl', joints: 'shoulder–elbow–wrist', camera: 'front', count: 'per-side elbow flexion/extension', form: 'torso-swing screening' },
  triceps_extension: { label: 'Elbow extension', joints: 'shoulder–elbow–wrist', camera: 'side', count: 'per-side elbow extension/flexion', form: 'none' },
  horizontal_pull: { label: 'Horizontal pull', joints: 'shoulder–elbow–wrist', camera: 'front', count: 'bilateral elbow flexion/extension', form: 'torso-swing screening' },
  vertical_pull: { label: 'Vertical pull', joints: 'shoulder–elbow–wrist', camera: 'front', count: 'bilateral elbow flexion/extension', form: 'torso-swing screening' },
  lateral_raise: { label: 'Lateral raise', joints: 'hip–shoulder–elbow', camera: 'front', count: 'per-side shoulder abduction', form: 'torso-swing screening' },
  front_raise: { label: 'Front raise', joints: 'hip–shoulder–elbow', camera: 'side', count: 'per-side shoulder flexion', form: 'torso-swing screening' },
  calf_raise: { label: 'Calf raise', joints: 'knee–ankle–foot', camera: 'side', count: 'bilateral plantarflexion', form: 'none' },
  core_flexion: { label: 'Core flexion', joints: 'shoulder–hip–knee', camera: 'side', count: 'bilateral trunk/hip flexion', form: 'none' },
  core_isometric: { label: 'Core hold', joints: 'shoulder–hip–ankle', camera: 'side', count: 'isometric hold timer', form: 'body-line screening' },
  jumping_jack: { label: 'Jumping jack', joints: 'hip–shoulder–elbow', camera: 'front', count: 'per-side shoulder abduction', form: 'none' },
  mountain_climber: { label: 'Mountain climber', joints: 'hip–knee–ankle', camera: 'side', count: 'per-side knee drive', form: 'none' },
  high_knees: { label: 'High knees', joints: 'hip–knee–ankle', camera: 'side', count: 'per-side knee drive', form: 'none' },
};

// Must match the `mode` field of each spec in shared/exerciseEngine.ts.
const BASE_MODE = {
  chest_fly: 'bilateral', hip_abduction: 'bilateral',
  squat: 'bilateral', squat_hold: 'hold', lunge: 'per_side', hinge: 'bilateral', hip_thrust: 'bilateral',
  horizontal_push: 'bilateral', vertical_push: 'bilateral', dip: 'bilateral', curl: 'per_side',
  triceps_extension: 'per_side', horizontal_pull: 'bilateral', vertical_pull: 'bilateral',
  lateral_raise: 'per_side', front_raise: 'per_side', calf_raise: 'bilateral', core_flexion: 'bilateral',
  core_isometric: 'hold', jumping_jack: 'per_side', mountain_climber: 'per_side', high_knees: 'per_side',
};

// Movements where 33 landmarks cannot determine the working movement. Each is
// rejected before any positive rule can claim it.
const UNSUPPORTED_RULES = [
  { test: /\b(wrist|forearm|hand grip|grip strengthener|grip machine|finger|hand curl|wrist roller|wrist extension|wrist flexion)\b/, reason: 'Working motion is wrist/finger movement; the 33 pose landmarks do not include hand or finger joints.' },
  { test: /\b(foam roller|roller|massage|mobility|stretch|flexibility|yoga|pigeon|scorpion|puppy|butterfly|cobra|upward facing dog|downward facing dog|cat cow|thread the needle|world greatest|inchworm)\b/, reason: 'Mobility or stretch drill: no repetition cycle is defined and joint excursion is not a training repetition.' },
  { test: /\b(farmer|farmers|carry|suitcase carry|waiter walk|walk|lunge walk|run|jog|sprint|crawl|bear crawl|high knee run|stepmill|stair|bike|elliptical|ski erg|rowing machine|upper body ergometer|treadmill)\b/, reason: 'Locomotion or ergometer work: counted by distance/time, not by a pose-derived repetition.' },
  { test: /\b(clean|snatch|jerk|thruster|turkish get up|get up|burpee|devil press|complex|circuit|combo|man maker|wall walk|handstand walk)\b/, reason: 'Multi-phase or ballistic lift: one repetition contains several distinct movements and cannot be inferred from a single joint angle.' },
  { test: /\b(bench dip|balance|single leg stand|stand on one leg|wall sit with|plank jack|jump rope|skipping|battle rope|rope wave|sledge|tire flip|sled push|sled drag|box jump|depth jump|broad jump|vertical jump|tuck jump|star jump)\b/, reason: 'Movement depends on equipment contact, jump height or balance state that the landmark angles cannot resolve.' },
  { test: /\b(pullover|straight arm pulldown|pec deck|chest fly|fly|flye|crossover|reverse fly|rear delt fly)\b/, reason: 'Determinant motion is shoulder horizontal adduction/abduction with a near-static elbow; the implemented patterns would measure the wrong joint.' },
  { test: /\b(leg curl|nordic curl|leg extension|hip abduction|hip adduction|glute kickback|kickback machine|back extension machine|hyperextension machine)\b/, reason: 'Machine isolation with the working joint against a pad; landmarks are occluded and the visible angle does not track the load.' },
  { test: /\b(shrug|upright row|neck|chin tuck|scapular|external rotation|internal rotation|rotation|twist|woodchop|chop|lift and chop|halo|around the world)\b/, reason: 'Rotation, scapular or neck motion cannot be measured reliably from 2D pose landmarks.' },
  { test: /\b(superman|hollow hold|hollow rock|reverse hyper|bird dog| dead bug|deadbug|ab wheel|ab roller|rollout|body saw|plank up|plank shoulder|side plank with|plank reach|plank rotation)\b/, reason: 'Hold or floor variation whose working position is not the implemented shoulder–hip–ankle hold line.' },
];

// Exact-name corrections for movements the generic regexes cannot separate.
// Values of null mean "do not claim a pattern"; the exercise is UNSUPPORTED.
const OVERRIDES = new Map(Object.entries({
  'lower back curl': null,
  'cable squat row with rope attachment': 'horizontal_pull',
  'sled single leg calf press on leg press': 'calf_raise',
  'bridge mountain climber cross body': null,
  'london bridge': null,
  'side bridge': 'core_isometric',
  'isometric wipers': null,
  'isometric chest squeeze': null,
  'hanging straight leg hip raise': 'core_flexion',
  'hanging leg hip raise': 'core_flexion',
  'lying leg hip raise': 'core_flexion',
  'incline leg hip raise leg straight': 'core_flexion',
  'hanging straight twisting leg hip raise': 'core_flexion',
  'weighted hanging leg hip raise': 'core_flexion',
  'dumbbell step up lunge': 'lunge',
  'exercise ball dip': null,
  'swing 360': null,
  'weighted kneeling step with swing': null,
  'machine back extension': null,
  'exercise ball back extension with hands behind head': null,
  'exercise ball back extension with arms extended': null,
  'back extension on exercise ball': null,
  'smith hip raise': 'hip_thrust',
  'hip raise bent knee': 'hip_thrust',
  'glute bridge march': 'hip_thrust',
  'pelvic tilt into bridge': 'hip_thrust',
  'rear decline bridge': 'hip_thrust',
  'single leg bridge with outstretched leg': 'hip_thrust',
}));

const POSITIVE_RULES = [
  { pattern: 'squat_hold', test: /\b(wall sit|wall squat hold)\b/ },
  { pattern: 'lunge', test: /\b(lunge|reverse lunge|walking lunge|curtsy lunge|curtsey lunge|side lunge|deficit lunge|split squat|step up)\b/ },
  { pattern: 'squat', test: /\b(squat|hack squat|leg press|sissy squat|juarez valley squat|zercher squat|front squat|overhead squat|goblet squat|sumo squat|jump squat|pistol squat)\b/ },
  { pattern: 'calf_raise', test: /\b(calf press|calf raise|calf raise hold)\b/ },
  { pattern: 'hinge', test: /\b(deadlift|romanian|rdl|stiff leg|good morning|hip hinge|swing|pull through|hip extension|back extension|reverse hyper)\b/ },
  { pattern: 'hip_thrust', test: /\b(hip thrust|glute bridge|frog pump|hip raise|single leg bridge|bridge)\b/ },
  { pattern: 'dip', test: /\b(dip|triceps dip|chest dip)\b/ },
  { pattern: 'horizontal_push', test: /\b(push up|pushup|bench press|chest press|floor press|press up|incline press|decline press|close grip press|board press)\b/ },
  { pattern: 'vertical_push', test: /\b(shoulder press|overhead press|military press|arnold press|push press|landmine press|z press|seated press|dumbbell press)\b/ },
  { pattern: 'curl', test: /\bcurl\b/ },
  { pattern: 'triceps_extension', test: /\b(triceps|skull crusher|french press|pushdown|push down|overhead extension|kickback|jm press|tate press)\b/ },
  { pattern: 'horizontal_pull', test: /\b(row|face pull|high pull|pull apart|band pull)\b/ },
  { pattern: 'vertical_pull', test: /\b(pulldown|pull down|pull ?ups?|pullups?|chin ?ups?|chinups?|lat pull)\b/ },
  { pattern: 'lateral_raise', test: /\b(lateral raise|side raise|scaption|rear delt raise|rear lateral raise)\b/ },
  { pattern: 'front_raise', test: /\b(front raise|raise front)\b/ },
  { pattern: 'calf_raise', test: /\b(calf raise|calf press|heel raise|donkey calf)\b/ },
  { pattern: 'jumping_jack', test: /\b(jumping jack|jack jump|star jack)\b/ },
  { pattern: 'mountain_climber', test: /\b(mountain climber|climber)\b/ },
  { pattern: 'high_knees', test: /\b(high knee|high knees)\b/ },
  { pattern: 'core_flexion', test: /\b(crunch|sit up|leg raise|knee raise|leg lift|knee lift|v up|jackknife|toes to bar|bicycle|dead bug|deadbug|toe tap|heel tap|reverse crunch|lying leg|hanging knee|hanging leg|captain chair)\b/ },
  { pattern: 'core_isometric', test: /\b(plank|hollow body hold|iso hold|isometric)\b/ },
];

// Secondary evidence from the catalog's own target muscles. Only used for names
// whose movement noun is unambiguous; rejections above always win.
const MUSCLE_FALLBACKS = [
  { pattern: 'vertical_push', noun: /\bpress\b/, target: /deltoids|shoulders/ },
  { pattern: 'horizontal_push', noun: /\bpress\b/, target: /pectorals|chest/ },
  { pattern: 'horizontal_pull', noun: /\brow\b/, target: /latissimus|upper back|back/ },
  { pattern: 'vertical_pull', noun: /\bpull\b/, target: /latissimus|upper back|back/ },
  { pattern: 'curl', noun: /\bcurl\b/, target: /biceps/ },
  { pattern: 'triceps_extension', noun: /\bextension\b/, target: /triceps/ },
  { pattern: 'core_flexion', noun: /\b(crunch|sit up|leg raise)\b/, target: /abdominals/ },
];

const MACHINE_EQUIPMENT = /machine|smith|sled|cable|assisted|stability ball|bosu|suspension|medicine ball|ab wheel|rope|towel|hammer|tire|weighted/;
// Only equipment that physically sits between the camera and the measured joints.
const OCCLUDING_EQUIPMENT = /machine|smith|sled|assisted|leg press|hack squat|ab wheel|stability ball|bosu/;
const FLOOR_OR_BENCH_POSITION = /\b(lying|prone|supine|reclined|floor|on floor|floor press|bench press|incline bench|decline bench|bench dip)\b/;
const LOADED_EQUIPMENT = /barbell|dumbbell|kettlebell|ez bar|trap bar|olympic barbell|resistance band|weighted/;
const LYING_POSITION = /\b(lying|prone|supine|seated|kneeling|reclined|incline bench|decline bench|bench)\b/;
const SIDE_ATTRIBUTION = /\b(single arm|single leg|one arm|one leg|alternating|alternate|side)\b/;
const FAST_MOTION = /\b(jump|jumping|plyo|push press|high knee|mountain climber|jack)\b/;
const UNILATERAL_METADATA = /\b(single|one)\s+(arm|leg|side)\b|\b(alternating|alternate|unilateral)\b|\b(left|right)\s+(arm|leg)\b/;

const DATASET_PATTERNS = new Set(['squat', 'hinge', 'curl', 'triceps_extension', 'horizontal_push', 'core_flexion', 'core_isometric', 'lateral_raise']);

const byId = new Map();
const patternMembers = new Map();
const counts = { FULLY_SUPPORTED: 0, PARTIALLY_SUPPORTED: 0, NOT_YET_VALIDATED: 0, UNSUPPORTED: 0 };
const patternCounts = {};

for (const exercise of catalog) {
  const id = String(exercise.exerciseId ?? '');
  const name = String(exercise.name ?? '');
  const normalized = norm(name);
  const equipment = (exercise.equipments ?? []).map(norm);
  const bodyParts = (exercise.bodyParts ?? []).map(norm);
  const instructions = (exercise.instructions ?? []).map(norm).join(' ');

  const blocked = UNSUPPORTED_RULES.find((rule) => rule.test.test(normalized));
  let pattern = null;
  let gapReason = null;

  if (/^(machine|lever|sled|cable|dumbbell).*\b(chest fly|seated fly|pec deck|butterfly)\b/.test(normalized) && !/reverse|rear/.test(normalized)) {
    pattern = 'chest_fly';
  } else if (/\b(machine|lever)\b.*\bhip abduction\b/.test(normalized)) {
    pattern = 'hip_abduction';
  } else if (OVERRIDES.has(normalized)) {
    pattern = OVERRIDES.get(normalized);
  } else if (!blocked) {
    const positive = POSITIVE_RULES.find((rule) => rule.test.test(normalized));
    if (positive) {
      pattern = positive.pattern;
      // Correct a few names the generic rules would otherwise capture.
      if (pattern === 'curl' && /leg|nordic|wrist|finger|neck|toe/.test(normalized)) pattern = null;
    } else {
      const target = (exercise.targetMuscles ?? []).map(norm).join(' ');
      const fallback = MUSCLE_FALLBACKS.find((rule) => rule.noun.test(normalized) && rule.target.test(target));
      if (fallback) pattern = fallback.pattern;
    }
  }

  // Per-exercise overrides come only from catalog metadata that names a concrete
  // movement property. Empty override means the family configuration is used as-is.
  const override = {};
  const overrideBasis = [];
  if (pattern) {
    const baseMode = BASE_MODE[pattern];
    if (baseMode && baseMode !== 'hold' && baseMode !== 'per_side' && UNILATERAL_METADATA.test(`${normalized} ${instructions}`)) {
      override.mode = 'per_side';
      overrideBasis.push('name/instructions describe a unilateral or alternating movement');
    }
    const occluded = equipment.some((value) => OCCLUDING_EQUIPMENT.test(value));
    if (FLOOR_OR_BENCH_POSITION.test(normalized) || occluded) {
      override.visibility = 0.45;
      overrideBasis.push(occluded ? 'machine or bench equipment can occlude the measured joints' : 'floor or bench position can hide the far-side landmarks');
    }
    if (FAST_MOTION.test(normalized)) {
      override.minRepMs = 250;
      override.maxRepMs = 6000;
      override.dwellMs = 50;
      overrideBasis.push('name describes a fast or ballistic movement');
    }
  }

  const gaps = [];
  if (pattern) {
    if (equipment.some((value) => MACHINE_EQUIPMENT.test(value))) gaps.push('equipment can occlude the measured joints');
    if (equipment.some((value) => LOADED_EQUIPMENT.test(value))) gaps.push('external load is not observed; only the body segment angle is measured');
    if (LYING_POSITION.test(normalized)) gaps.push('floor/bench position hides the far-side landmarks');
    if (SIDE_ATTRIBUTION.test(normalized) || ['lunge', 'curl', 'triceps_extension', 'lateral_raise', 'front_raise', 'jumping_jack', 'mountain_climber', 'high_knees'].includes(pattern)) {
      gaps.push('per-side counting attributes a repetition to the more visible side');
    }
    if (FAST_MOTION.test(normalized)) gaps.push('fast movement may fall between sampled frames');
    if (pattern === 'core_isometric' || pattern === 'squat_hold') gaps.push('hold quality is inferred from joint stability only');
    if (pattern === 'core_flexion' && /twist|bicycle|rotation/.test(normalized)) gaps.push('rotation is not measured; only flexion is counted');
    if (pattern === 'squat' && /leg press|hack squat|smith/.test(normalized)) gaps.push('machine path constrains the movement; the free-weight squat model may not match');
  }

  let support;
  let reason;
  if (!pattern) {
    support = 'UNSUPPORTED';
    reason = blocked?.reason ?? 'No deterministic landmark configuration exists for this movement in the current engine; the name alone is not evidence of support.';
  } else if (gaps.length) {
    support = 'PARTIALLY_SUPPORTED';
    reason = `Implemented ${PATTERNS[pattern].label} pattern with known limitation: ${gaps[0]}.`;
  } else {
    support = 'NOT_YET_VALIDATED';
    reason = `Implemented ${PATTERNS[pattern].label} pattern; no real-person validation for this exercise.`;
  }
  counts[support] += 1;
  if (pattern) {
    patternCounts[pattern] = (patternCounts[pattern] ?? 0) + 1;
    if (!patternMembers.has(pattern)) patternMembers.set(pattern, []);
    patternMembers.get(pattern).push(name);
    gapReason = gaps.length ? gaps : null;
  }

  byId.set(id, {
    id, name, pattern, support, reason, gaps: gapReason, camera: pattern ? PATTERNS[pattern].camera : null,
    override: Object.keys(override).length ? override : null, overrideBasis,
  });
}

const ids = [...byId.keys()];
if (ids.length !== 1500) throw new Error(`Expected 1500 unique IDs, got ${ids.length}`);

const generatedAt = new Date().toISOString();
const header = `// GENERATED by scripts/generate-exercise-coverage.mjs from ml/data/exercisedb_catalog.json.\n// Do not edit by hand. Regenerate with: node scripts/generate-exercise-coverage.mjs\n// ${generatedAt}\n`;

const compact = Object.fromEntries([...byId.values()].map((row) => {
  const entry = { pattern: row.pattern, support: row.support };
  if (row.override) entry.override = row.override;
  return [row.id, entry];
}));
const overrideCount = [...byId.values()].filter((row) => row.override).length;
const modeOverrideCount = [...byId.values()].filter((row) => row.override?.mode).length;
const ts = `${header}\nexport type CatalogSupport = 'FULLY_SUPPORTED' | 'PARTIALLY_SUPPORTED' | 'NOT_YET_VALIDATED' | 'UNSUPPORTED';\nexport type CatalogTrackingRecord = { pattern: string | null; support: CatalogSupport; override?: Record<string, unknown> };\nexport const catalogTrackingMap: Record<string, CatalogTrackingRecord> = ${JSON.stringify(compact)};\n`;
writeFileSync(join(root, 'shared/exerciseTracking.generated.ts'), ts);
writeFileSync(join(root, 'backend/src/pose-tracker/catalog-tracking.generated.ts'), `${header}\nexport type CatalogTrackingRecord = { pattern: string | null; support: 'FULLY_SUPPORTED' | 'PARTIALLY_SUPPORTED' | 'NOT_YET_VALIDATED' | 'UNSUPPORTED'; override?: Record<string, unknown> };\nexport const catalogTrackingMap: Record<string, CatalogTrackingRecord> = ${JSON.stringify(compact)};\n`);

writeFileSync(join(root, 'output/exercisedb-v1-tracking-coverage.json'), JSON.stringify({
  generatedAt, catalogSize: catalog.length, uniqueIds: ids.length, counts, patternCounts, overrideCount, modeOverrideCount,
  records: [...byId.values()],
}, null, 2));

const cell = (value) => String(value).replace(/\|/g, '\\|');
const rows = [...byId.values()].map((row) => {
  const spec = row.pattern ? PATTERNS[row.pattern] : null;
  const hasData = row.pattern ? DATASET_PATTERNS.has(row.pattern) : false;
  const model = 'No exercise-specific model. pattern_v1 movement classifier is unvalidated per exercise.';
  const validation = row.support === 'UNSUPPORTED' ? 'Not applicable — no configuration' : 'No real-person clips for this exercise; device validation pending';
  const blockers = row.support === 'UNSUPPORTED' ? row.reason : (row.gaps?.join('; ') ?? 'Only validation is missing; no known implementation gap');
  const override = row.override ? [
    row.override.mode ? `mode ${row.override.mode}` : '',
    row.override.visibility !== undefined ? `visibility ${row.override.visibility}` : '',
    row.override.minRepMs !== undefined ? `min rep ${row.override.minRepMs} ms` : '',
    row.override.maxRepMs !== undefined ? `max rep ${row.override.maxRepMs} ms` : '',
    row.override.dwellMs !== undefined ? `dwell ${row.override.dwellMs} ms` : '',
  ].filter(Boolean).join('; ') : 'Family defaults';
  return `| ${cell(row.id)} | ${cell(row.name)} | ${spec?.label ?? 'None'} | ${spec?.joints ?? '—'} | ${spec?.camera ?? '—'} | ${row.pattern ? `${row.pattern} · ${spec.count}` : 'Manual logging only'} | ${cell(override)} | ${spec ? 'Joint-angle state machine' : '—'} | ${spec ? 'start → working → peak → returning' : '—'} | ${spec ? 'Smoothed joint angle, min/max excursion' : '—'} | ${spec?.form ?? '—'} | ${hasData ? 'PushUpBench (CC-BY-4.0) movement family' : 'No licensed training clips for this movement'} | ${model} | **${row.support.replaceAll('_', ' ')}** | ${validation} | ${row.overrideBasis?.length ? cell(row.overrideBasis.join('; ')) + '. ' : ''}${blockers} |`;
}).join('\n');

const summaryByPattern = Object.entries(patternCounts).sort((a, b) => b[1] - a[1]).map(([pattern, count]) => {
  const specs = PATTERNS[pattern];
  return `| ${specs.label} | \`${pattern}\` | ${count} | ${specs.camera} | ${specs.count} | ${specs.form} |`;
}).join('\n');

const md = `# ExerciseDB v1 — PoseTracker Tracking Coverage

Generated ${generatedAt} from the repository's actual ExerciseDB v1 catalog
(\`ml/data/exercisedb_catalog.json\`, ${catalog.length} rows) and the runtime patterns in
\`shared/exerciseEngine.ts\`. Regenerate with \`node scripts/generate-exercise-coverage.mjs\`.

## Classification rubric

An exercise is **not** supported because it has a registry row or a name match. Support requires an
implemented, exercise-appropriate analysis configuration. Validation is reported separately, because
implementation completeness and measured accuracy are different claims.

| Classification | Meaning |
|---|---|
| **FULLY SUPPORTED** | Configuration implemented **and** validated on real recordings of that exercise (subject-disjoint rep-count accuracy reported). Currently **0** exercises meet this. |
| **PARTIALLY SUPPORTED** | Configuration implemented, but a known capability gap remains (equipment occlusion, external load not observed, floor position, side attribution, fast sampling, hold inference). Accuracy is unvalidated. |
| **NOT YET VALIDATED** | Configuration implemented with no known capability gap, but no real-person validation exists for the exercise. Accuracy is unvalidated. |
| **UNSUPPORTED** | The determinant movement cannot be derived reliably from the 33 MediaPipe landmarks, or no deterministic configuration exists. Manual logging remains available. |

### What "validated" would require

The repository has real rep-count evidence for **two** PushUpBench clips
(\`ml/reports/t4_rep_counter/pushupbench_exercise_rep_results.json\`): 0 exact matches, 0 within ±1.
That is not enough to validate any exercise, which is why no row, and no pattern family, is marked
FULLY SUPPORTED. The pattern classifier (\`ml/models/pattern_v1\`) reports test macro-F1 0.36–0.47 and
is also not per-exercise evidence.

## Summary

| Classification | Exercises |
|---|---:|
| FULLY SUPPORTED | ${counts.FULLY_SUPPORTED} |
| PARTIALLY SUPPORTED | ${counts.PARTIALLY_SUPPORTED} |
| NOT YET VALIDATED | ${counts.NOT_YET_VALIDATED} |
| UNSUPPORTED | ${counts.UNSUPPORTED} |
| **Total** | **${catalog.length}** |

Per-exercise overrides generated: **${overrideCount}** (${modeOverrideCount} switch to per-side counting).
The remaining ${catalog.length - overrideCount} use the family defaults unchanged.

## Base configurations and per-exercise overrides

Each exercise has its own generated record. The family spec supplies the measured joint triplet,
camera, phase logic and default thresholds. The record may then carry per-exercise overrides derived
from that exercise's catalog metadata: unilateral/alternating names switch to per-side counting,
floor/bench/machine entries lower the visibility floor, and fast or paused movements adjust the
minimum rep time and peak dwell. Overrides never change the measured joints, never create a pattern,
and are not validation evidence. Exercises without a metadata signal use the family defaults and are
marked "Family defaults" in the matrix.

| Pattern | ID | Exercises | Camera | Repetition logic | Form screening |
|---|---|---:|---|---|---|
${summaryByPattern}

## Full matrix

Columns: catalog ID · exact catalog name · movement pattern · measured landmarks · required camera ·
tracking configuration · repetition implementation · phase detection · range of motion · form
assessment · dataset/training data · model support · classification · validation · blockers.

| ID | Exercise | Pattern | Landmarks | Camera | Configuration | Per-exercise override | Rep counting | Phases | ROM | Form | Dataset | Model | Classification | Validation | Blockers |
|---|---|---|---|---|---|---|---|---|---|---:|---|---|---|
${rows}

## Honest limitations

- No exercise has real-device or real-person validation. The native paths are implemented but must be
  treated as experimental until \`POSETRACKER_DEVICE_VALIDATION.md\` records actual device runs.
- Form rules are landmark screening heuristics, not technique or safety assessments.
- External load, machine resistance, band tension and exercise identity are not observed by pose
  landmarks; only body-segment geometry is.
- Uploaded-video and live paths share the same engine and thresholds, but sampling rates differ
  (live ≈15 fps, video 10 fps). The parity test checks identical landmark sequences at both rates;
  it does not replace device testing on recorded video.
`;
writeFileSync(join(root, 'EXERCISEDB_V1_TRACKING_COVERAGE.md'), md);

console.log('catalog', catalog.length, 'unique', ids.length);
console.log(counts);
console.log(patternCounts);
