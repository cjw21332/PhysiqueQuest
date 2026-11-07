// Shared pure registry: imported by the browser, API and catalog audit. No credentials or I/O.
export const configurationVersion = 1;
export const providerExercises = ['squat','push_up','plank','lunge','side_lunge','deadlift','glute_bridge','calf_raise','tricep_dip','bicep_curl','hammer_curl','shoulder_press','lateral_raise','mountain_climber','high_knees','jumping_jack','low_impact_jack','leg_raise','wall_sit','balance_leg','balance_leg_left','balance_leg_right','shoulder_roll','shoulder_deep_breath','chair_forward_fold','chair_side_stretch','split','facial_split','pancake','closing','bridge','cobra','bow','tiger','camel','king_pigeon','foot_to_hand','i','needle','back_flexibility_test'] as const;
export type CatalogExercise = { exerciseId?: string; _id?: string; name: string; bodyParts?: string[]; targetMuscles?: string[]; equipments?: string[]; instructions?: string[]; equipment?: string; targetMuscle?: string; group?: string };

// Generated-angle config from GIF analysis pipeline
export type GeneratedAngleConfig = {
  source: 'gif-derived';
  verified: boolean;
  liveValidated: boolean;
  primaryJoints: string[];           // e.g., ['left_knee', 'right_knee']
  sideMode: 'bilateral' | 'unilateral' | 'alternating' | 'unknown';
  startAngles: Record<string, number>;   // joint -> angle (degrees)
  peakAngles: Record<string, number>;
  directions: Record<string, 'increasing' | 'decreasing'>;
  referenceRanges: Record<string, number>; // joint -> range (degrees)
  stabilityConstraints: Array<{ joint: string; meanAngle: number; tolerance: number }>;
  viewHint: 'front' | 'side' | 'unknown';
  cycleCount: number;
  validFraction: number;
  thresholdsUsed: Record<string, number>;
  generatorVersion: string;
  generatedAt: string;
};

export type TrackingConfig = {
  exerciseId: string; name: string; normalizedName: string; bodyParts: string[]; targetMuscles: string[]; equipment: string[];
  category: string; trackingMode: 'builtin' | 'reference' | 'generated-angle' | 'unavailable';
  providerExerciseId?: string; referenceUuid?: string; generatedAngleConfig?: GeneratedAngleConfig;
  cameraOrientation: 'front' | 'side' | 'reference' | 'pending'; capabilities: string[];
  referenceStatus: 'not-required' | 'required' | 'awaiting-verification' | 'verified' | 'disabled';
  validationStatus: 'documentation-mapped' | 'pending' | 'verified' | 'disabled'; limitations: string[]; configurationVersion: number;
  verificationNotes?: string; verifiedAt?: string; updatedAt?: string;
};
export type ConfigOverride = Pick<TrackingConfig, 'trackingMode' | 'cameraOrientation' | 'validationStatus' | 'limitations'> & { providerExerciseId?: string; referenceUuid?: string; generatedAngleConfig?: GeneratedAngleConfig; verificationNotes?: string; verifiedAt?: string; updatedAt?: string };
export const normalizeName = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();
export const holdExercises = new Set(['plank','wall_sit','balance_leg','balance_leg_left','balance_leg_right','chair_forward_fold','chair_side_stretch','split','facial_split','pancake','closing','bridge','cobra','bow','tiger','camel','king_pigeon','foot_to_hand','i','needle']);
// Exact movement + equipment + target + instructional evidence, never substring-only support.
const rules: { names: string[]; equipment: string; target: RegExp; instruction: RegExp; provider: string; camera: 'front' | 'side' }[] = [
  { names:['quads bodyweight squat','bodyweight squat'],equipment:'bodyweight',target:/quadriceps/,instruction:/knees.*hips|hips.*knees/,provider:'squat',camera:'front' },
  { names:['push up'],equipment:'bodyweight',target:/pectorals/,instruction:/elbows/,provider:'push_up',camera:'side' },
  { names:['forward lunge'],equipment:'bodyweight',target:/quadriceps|glutes/,instruction:/knee/,provider:'lunge',camera:'side' },
  { names:['bodyweight standing calf raise'],equipment:'bodyweight',target:/calves/,instruction:/heel/,provider:'calf_raise',camera:'side' },
  { names:['low glute bridge on floor'],equipment:'bodyweight',target:/glutes/,instruction:/hip/,provider:'glute_bridge',camera:'side' },
  { names:['dumbbell biceps curl','dumbbell standing biceps curl'],equipment:'dumbbell',target:/biceps/,instruction:/elbow/,provider:'bicep_curl',camera:'front' },
  { names:['dumbbell hammer curl'],equipment:'dumbbell',target:/biceps/,instruction:/palms facing each other/,provider:'hammer_curl',camera:'front' },
  { names:['dumbbell lateral raise'],equipment:'dumbbell',target:/deltoids/,instruction:/shoulder/,provider:'lateral_raise',camera:'front' },
  { names:['mountain climber'],equipment:'bodyweight',target:/cardiovascular|abdominals/,instruction:/knee/,provider:'mountain_climber',camera:'side' },
  { names:['front plank','plank'],equipment:'bodyweight',target:/abdominals|core/,instruction:/hold|maintain/,provider:'plank',camera:'side' },
];
export function resolveTrackingConfig(row: CatalogExercise, override?: ConfigOverride): TrackingConfig {
  const name = normalizeName(row.name), equipment = row.equipments ?? (row.equipment ? [row.equipment] : []);
  const targets = row.targetMuscles ?? (row.targetMuscle ? [row.targetMuscle] : []);
  const instructions = (row.instructions ?? []).join(' ').toLowerCase();
  const rule = rules.find(r => r.names.includes(name) && equipment.length === 1 && normalizeName(equipment[0]) === r.equipment && r.target.test(targets.join(' ').toLowerCase()) && r.instruction.test(instructions));
  const category = /stretch|mobility/.test(name) ? 'mobility' : /plank|wall sit|static|hold/.test(name) ? 'isometric' : equipment.some(e => /machine/.test(e)) ? 'machine-occlusion' : /single arm|single leg|alternate|twist|rotation/.test(name) ? 'multiple-observations' : equipment.includes('cable') ? 'additional-camera-setup' : 'repetition';
  const config: TrackingConfig = {
    exerciseId: row.exerciseId ?? row._id ?? '', name: row.name, normalizedName: name, bodyParts: row.bodyParts ?? (row.group ? [row.group] : []), targetMuscles: targets, equipment,
    category, trackingMode: rule ? 'builtin' : 'unavailable', providerExerciseId: rule?.provider, cameraOrientation: rule?.camera ?? 'pending',
    capabilities: rule ? (category === 'isometric' ? ['session-duration','provider-feedback'] : ['repetitions','provider-feedback']) : [],
    referenceStatus: rule ? 'not-required' : 'required', validationStatus: rule ? 'documentation-mapped' : 'pending',
    limitations: rule ? ['Provider identifier and catalog metadata matched; real-person accuracy and account access are not validated.', 'Camera cannot assess pain, injury risk or equipment load.'] : [category === 'machine-occlusion' ? 'Equipment can obscure joints; camera feasibility and a specific reference require verification.' : category === 'isometric' || category === 'mobility' ? 'Duration alone does not verify the held position or stretching technique; provider configuration requires review.' : 'No verified built-in mapping. An exercise-specific reference and camera validation are required.'], configurationVersion,
  };
  if (override) {
    config.providerExerciseId = undefined;
    config.referenceUuid = undefined;
    config.generatedAngleConfig = undefined;
    Object.assign(config, override);
    config.referenceStatus = override.validationStatus === 'disabled' ? 'disabled' : override.trackingMode === 'reference' ? (override.validationStatus === 'verified' ? 'verified' : 'awaiting-verification') : 'not-required';
    if (override.trackingMode === 'builtin' && holdExercises.has(override.providerExerciseId ?? '')) config.category='isometric';
    if (override.trackingMode === 'generated-angle') {
      config.capabilities = override.validationStatus === 'disabled' ? [] : ['repetitions','experimental'];
      config.generatedAngleConfig = override.generatedAngleConfig;
    } else {
      config.capabilities = override.validationStatus === 'disabled' ? [] : override.trackingMode === 'reference' ? [config.category==='isometric'||config.category==='mobility'?'session-duration':'repetitions','reference-similarity'] : override.trackingMode === 'builtin' ? (holdExercises.has(override.providerExerciseId ?? '') ? ['session-duration','provider-feedback'] : ['repetitions','provider-feedback']) : [];
    }
  }
  return config;
}
export function validateOverride(value: ConfigOverride) {
  if (!['builtin','reference','generated-angle','unavailable'].includes(value.trackingMode)) throw Error('Invalid tracking mode');
  if (!['front','side','reference','pending'].includes(value.cameraOrientation)) throw Error('Invalid camera orientation');
  if (!['pending','verified','disabled'].includes(value.validationStatus)) throw Error('Invalid validation status');
  if (value.providerExerciseId && value.referenceUuid) throw Error('Exercise and reference are mutually exclusive');
  if (value.trackingMode === 'builtin' && (!providerExercises.includes(value.providerExerciseId as typeof providerExercises[number]) || value.referenceUuid)) throw Error('Unknown built-in exercise');
  if (value.trackingMode === 'reference' && (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.referenceUuid ?? '') || value.providerExerciseId)) throw Error('A genuine reference UUID is required');
  if (value.trackingMode === 'generated-angle' && (!value.generatedAngleConfig || !value.generatedAngleConfig.primaryJoints?.length)) throw Error('Generated-angle mode requires generatedAngleConfig with primaryJoints');
  if (value.trackingMode === 'unavailable' && (value.referenceUuid || value.providerExerciseId || value.generatedAngleConfig)) throw Error('Unavailable configurations cannot contain a tracking identifier');
  if (!Array.isArray(value.limitations) || value.limitations.length > 20 || value.limitations.some(s => typeof s !== 'string' || s.length > 500)) throw Error('Invalid limitations');
  if (value.validationStatus === 'verified' && (!value.verificationNotes?.trim() || value.cameraOrientation === 'pending' || value.trackingMode === 'unavailable')) throw Error('Verification requires provider test evidence and camera setup');
}
export const canTrack = (config: TrackingConfig) => config.validationStatus !== 'disabled' && (
  config.trackingMode === 'builtin' && ['documentation-mapped','verified'].includes(config.validationStatus) ||
  config.trackingMode === 'reference' && config.validationStatus === 'verified' ||
  config.trackingMode === 'generated-angle' && config.validationStatus === 'verified'
);
export function auditCoverage(rows: CatalogExercise[], overrides: Record<string, ConfigOverride> = {}) {
  const records = rows.map(row => resolveTrackingConfig(row, overrides[row.exerciseId ?? row._id ?? '']));
  const ids = rows.map(r => r.exerciseId ?? r._id ?? '');
  const mapped = records.map(r => r.exerciseId);
  const duplicates = ids.filter((id,i) => ids.indexOf(id) !== i);
  return { generatedAt: new Date().toISOString(), totalCatalog: rows.length, uniqueExerciseIds: new Set(ids).size, totalMapped: records.length, builtIn: records.filter(r=>r.trackingMode==='builtin').length, configuredReferences: records.filter(r=>r.referenceStatus==='verified').length, referencesAwaitingVerification: records.filter(r=>r.referenceStatus==='awaiting-verification').length, referencesRequired: records.filter(r=>r.referenceStatus==='required').length, pending: records.filter(r=>r.validationStatus==='pending').length, unsupported: records.filter(r=>r.validationStatus==='disabled').length, additionalCameraSetup: records.filter(r=>['machine-occlusion','additional-camera-setup','multiple-observations'].includes(r.category)).length, withoutValidTrackingMode: records.filter(r=>!canTrack(r)).length, validated: records.filter(r=>r.validationStatus==='verified').length, duplicateMappings: duplicates, missingMappings: ids.filter(id=>!mapped.includes(id)), orphanOverrides: Object.keys(overrides).filter(id=>!ids.includes(id)), coverageComplete: ids.every(id=>mapped.includes(id)) && !duplicates.length && !ids.includes(''), records };
}
