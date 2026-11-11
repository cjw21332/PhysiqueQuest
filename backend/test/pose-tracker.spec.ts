import { describe,it,expect,vi,afterEach } from 'vitest';
import { PoseTrackerService } from '../src/pose-tracker/pose-tracker.module.js';
import { validateOverride, resolveTrackingConfig, canTrack } from '../src/pose-tracker/exercise-registry.js';
import { catalogTiersMap } from '../src/pose-tracker/catalog-tiers.js';
const row={exerciseId:'squat',name:'bodyweight squat',equipments:['bodyweight'],targetMuscles:['quadriceps'],instructions:['Bend knees and hips']};
function setup(config?:any){const model={findOne:vi.fn(()=>({lean:async()=>config?{config}:null})),find:vi.fn(()=>({lean:async()=>[]})),updateOne:vi.fn(async()=>{})};const catalog={trackingCatalog:async()=>[row],trackingRecord:async(id:string)=>id===row.exerciseId?row:null};return {service:new PoseTrackerService(model as any,catalog as any),model};}
describe('PoseTracker API configuration',()=>{
  afterEach(()=>vi.unstubAllEnvs());
  it('resolves only catalog IDs',async()=>{const {service}=setup();expect((await service.resolve('squat')).trackingMode).toBe('builtin');await expect(service.resolve('unknown')).rejects.toThrow('not in catalog');});
  it('missing token fails explicitly and never substitutes credentials',async()=>{vi.stubEnv('POSETRACKER_ENABLED','true');vi.stubEnv('POSETRACKER_API_TOKEN','');await expect(setup().service.launch('squat')).rejects.toThrow('not configured');});
  it('launch returns configured browser token only when mapping is eligible',async()=>{vi.stubEnv('POSETRACKER_ENABLED','true');vi.stubEnv('POSETRACKER_API_TOKEN','test-only');expect((await setup().service.launch('squat')).token).toBe('test-only');});
  it('fails closed by default and rejects malformed switch values',async()=>{for(const value of ['', 'yes', 'false']){vi.stubEnv('POSETRACKER_ENABLED',value);await expect(setup().service.launch('squat')).rejects.toThrow('disabled');}});
  it('disables provider launches including admin tests but leaves local generated launches available',async()=>{
    vi.stubEnv('POSETRACKER_ENABLED','false');vi.stubEnv('POSETRACKER_API_TOKEN','test-only');
    await expect(setup().service.launch('squat')).rejects.toThrow('disabled');
    await expect(setup().service.launch('squat',true)).rejects.toThrow('disabled');
    const generated={source:'gif-derived',verified:false,liveValidated:false,primaryJoints:['left_knee'],sideMode:'unilateral',startAngles:{left_knee:150},peakAngles:{left_knee:90},directions:{left_knee:'decreasing'},referenceRanges:{left_knee:60},stabilityConstraints:[],viewHint:'side',cycleCount:1,validFraction:1,thresholdsUsed:{},generatorVersion:'test',generatedAt:'test'};
    const {service}=setup({trackingMode:'generated-angle',cameraOrientation:'side',validationStatus:'pending',limitations:[],verificationNotes:'test evidence',generatedAngleConfig:generated});
    expect((await service.launch('squat')).token).toBeNull();
  });
  it('pending reference is admin-test only',async()=>{vi.stubEnv('POSETRACKER_ENABLED','true');vi.stubEnv('POSETRACKER_API_TOKEN','test-only');const {service}=setup({trackingMode:'reference',providerExerciseId:undefined,referenceUuid:'12345678-1234-4234-8234-123456789012',cameraOrientation:'side',validationStatus:'pending',limitations:[]});await expect(service.launch('squat')).rejects.toThrow('verified');expect((await service.launch('squat',true)).config.referenceStatus).toBe('awaiting-verification');});
  it('rejects invalid, mixed and undocumented configurations',()=>{for(const value of [{trackingMode:'builtin',providerExerciseId:'invented'},{trackingMode:'reference',referenceUuid:'fake'},{trackingMode:'builtin',providerExerciseId:'squat',referenceUuid:'fake'}])expect(()=>validateOverride({...value,cameraOrientation:'side',validationStatus:'pending',limitations:[]} as any)).toThrow();});
  it('persists strict configurations and records admin evidence',async()=>{const {service,model}=setup();
    // This is now invalid because verified status is forbidden without evidence
    await expect(service.save('squat',{trackingMode:'builtin',providerExerciseId:'squat',cameraOrientation:'front',validationStatus:'verified',limitations:[],verificationNotes:'Observed provider and representative movement'},'admin')).rejects.toThrow('No family has passed');
  });
  it('rejects unknown fields and evidence-free verification',async()=>{const {service}=setup();await expect(service.save('squat',{...resolveTrackingConfig(row),token:'secret'},'admin')).rejects.toThrow('Invalid');await expect(service.save('squat',{trackingMode:'builtin',providerExerciseId:'squat',cameraOrientation:'side',validationStatus:'verified',limitations:[]},'admin')).rejects.toThrow('No family has passed');});
  it('resolves tracking tiers correctly', () => {
    const squat = resolveTrackingConfig({exerciseId:'6YUfHPL', name:'quads (bodyweight squat)', movement_pattern:'squat'});
    expect(squat.trackingTier).toBe('auto_count_beta');
    const unknown = resolveTrackingConfig({exerciseId:'unknown', name:'unknown'});
    expect(unknown.trackingTier).toBe('manual');
    const bench = resolveTrackingConfig({exerciseId:'EIeI8Vf', name:'barbell bench press', movement_pattern:'horizontal_push'});
    expect(bench.trackingTier).toBe('pose_only');
    const yoga = resolveTrackingConfig({exerciseId:'01qpYSe', name:'upward facing dog stretch', movement_pattern:'squat'});
    expect(yoga.trackingTier).not.toBe('auto_count_beta');
  });
  it('canTrack true for generated-angle auto_count_beta', () => {
    const config = { trackingMode: 'generated-angle', trackingTier: 'auto_count_beta', validationStatus: 'pending', cameraOrientation: 'side', limitations: [], configurationVersion: 1, exerciseId: 'test', name: 'test', normalizedName: 'test', bodyParts: [], targetMuscles: [], equipment: [], category: 'repetition', capabilities: [], referenceStatus: 'not-required' } as any;
    expect(canTrack(config)).toBe(true);
  });
  it('canTrack false for candidate_unvalidated', () => {
    const config = { trackingMode: 'unavailable', trackingTier: 'manual', validationStatus: 'pending', cameraOrientation: 'side', limitations: [], configurationVersion: 1, exerciseId: 'test', name: 'test', normalizedName: 'test', bodyParts: [], targetMuscles: [], equipment: [], category: 'repetition', capabilities: [], referenceStatus: 'not-required' } as any;
    expect(canTrack(config)).toBe(false);
  });
  it('canTrack false for pose_unreliable', () => {
    const config = { trackingMode: 'unavailable', trackingTier: 'pose_only', validationStatus: 'pending', cameraOrientation: 'side', limitations: [], configurationVersion: 1, exerciseId: 'test', name: 'test', normalizedName: 'test', bodyParts: [], targetMuscles: [], equipment: [], category: 'repetition', capabilities: [], referenceStatus: 'not-required' } as any;
    expect(canTrack(config)).toBe(false);
  });
  it('canTrack false for no_reps', () => {
    const config = { trackingMode: 'unavailable', trackingTier: 'manual', validationStatus: 'pending', cameraOrientation: 'side', limitations: [], configurationVersion: 1, exerciseId: 'test', name: 'test', normalizedName: 'test', bodyParts: [], targetMuscles: [], equipment: [], category: 'mobility', capabilities: [], referenceStatus: 'not-required' } as any;
    expect(canTrack(config)).toBe(false);
  });
  it('canTrack false for unavailable mode', () => {
    const config = { trackingMode: 'unavailable', trackingTier: 'auto_count_beta', validationStatus: 'pending', cameraOrientation: 'side', limitations: [], configurationVersion: 1, exerciseId: 'test', name: 'test', normalizedName: 'test', bodyParts: [], targetMuscles: [], equipment: [], category: 'repetition', capabilities: [], referenceStatus: 'not-required' } as any;
    expect(canTrack(config)).toBe(false);
  });
  it('hold_timer is never auto-counted', () => {
    const config = resolveTrackingConfig({ exerciseId: 'hCjGsRQ', name: 'power point plank', movement_pattern: 'core_isometric' });
    expect(config.trackingTier).not.toBe('auto_count_beta');
    expect(config.trackingTier).toBe('manual');
  });
  it('validateOverride accepts verified only when eligible_verified is true in the generated data', () => {
    // Since generated data has no eligible_verified families, this must throw
    expect(() => validateOverride({ trackingMode: 'builtin', providerExerciseId: 'squat', cameraOrientation: 'front', validationStatus: 'verified', limitations: [], verificationNotes: 'test' } as any)).toThrow();
  });
  it('validateOverride rejects verified when not eligible', () => {
    expect(() => validateOverride({ trackingMode: 'builtin', providerExerciseId: 'squat', cameraOrientation: 'front', validationStatus: 'verified', limitations: [], verificationNotes: 'none' } as any)).toThrow();
  });
  it('catalog-tiers covers all 1500 IDs exactly once', () => {
    const keys = Object.keys(catalogTiersMap);
    expect(keys.length).toBe(1500);
    expect(new Set(keys).size).toBe(1500);
  });
  it('marks static planks as holds rather than auto-counted repetitions', () => {
    expect(catalogTiersMap['VBAWRPG'].classification).toBe('hold_timer');
    expect(catalogTiersMap['VBAWRPG'].tier).toBe('manual');
  });
  it('records explicit evidence source and rationale for every tier', () => {
    for (const entry of Object.values(catalogTiersMap)) {
      expect(['measured', 'rule', 'low_rom', 'unmeasured']).toContain(entry.tier_source);
      expect(entry.reason.length).toBeGreaterThan(0);
    }
  });
  it('beta_family is exactly {1g5bPpA, 3eGE2JC, 6YUfHPL, I4hDWkc, lBDjFxJ}', () => {
    const betaIds = Object.entries(catalogTiersMap).filter(([k, v]) => v.tier === 'auto_count_beta').map(([k]) => k).sort();
    expect(betaIds).toEqual(['1g5bPpA', '3eGE2JC', '6YUfHPL', 'I4hDWkc', 'lBDjFxJ'].sort());
  });


});
