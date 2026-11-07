import { describe,it,expect,vi,afterEach } from 'vitest';
import { PoseTrackerService } from '../src/pose-tracker/pose-tracker.module.js';
import { validateOverride, resolveTrackingConfig } from '../src/pose-tracker/exercise-registry.js';
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
    const {service}=setup({trackingMode:'generated-angle',cameraOrientation:'side',validationStatus:'verified',limitations:[],verificationNotes:'test evidence',generatedAngleConfig:generated});
    expect((await service.launch('squat')).token).toBeNull();
  });
  it('pending reference is admin-test only',async()=>{vi.stubEnv('POSETRACKER_ENABLED','true');vi.stubEnv('POSETRACKER_API_TOKEN','test-only');const {service}=setup({trackingMode:'reference',providerExerciseId:undefined,referenceUuid:'12345678-1234-4234-8234-123456789012',cameraOrientation:'side',validationStatus:'pending',limitations:[]});await expect(service.launch('squat')).rejects.toThrow('verified');expect((await service.launch('squat',true)).config.referenceStatus).toBe('awaiting-verification');});
  it('rejects invalid, mixed and undocumented configurations',()=>{for(const value of [{trackingMode:'builtin',providerExerciseId:'invented'},{trackingMode:'reference',referenceUuid:'fake'},{trackingMode:'builtin',providerExerciseId:'squat',referenceUuid:'fake'}])expect(()=>validateOverride({...value,cameraOrientation:'side',validationStatus:'pending',limitations:[]} as any)).toThrow();});
  it('persists strict configurations and records admin evidence',async()=>{const {service,model}=setup();await service.save('squat',{trackingMode:'builtin',providerExerciseId:'squat',cameraOrientation:'front',validationStatus:'verified',limitations:[],verificationNotes:'Observed provider and representative movement'},'admin');expect(model.updateOne).toHaveBeenCalledWith({exerciseId:'squat'},expect.objectContaining({$set:expect.objectContaining({updatedBy:'admin'})}),expect.anything());});
  it('rejects unknown fields and evidence-free verification',async()=>{const {service}=setup();await expect(service.save('squat',{...resolveTrackingConfig(row),token:'secret'},'admin')).rejects.toThrow('Invalid');await expect(service.save('squat',{trackingMode:'builtin',providerExerciseId:'squat',cameraOrientation:'side',validationStatus:'verified',limitations:[]},'admin')).rejects.toThrow('evidence');});
});
