"""Local-only DEV then frozen TEST evaluation. No threshold tuning."""
import csv, hashlib, json, sys, time
from pathlib import Path
import cv2, lance, mediapipe as mp, numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
ML=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ML/'src'))
from pq_ml.rep_harness import count_landmarks
OUT=ML/'reports/repcount'; OUT.mkdir(parents=True,exist_ok=True)
RAW=ML/'data/raw/repcount'; RAW.mkdir(parents=True,exist_ok=True)
CACHE=ML/'data/keypoints_repcount'; CACHE.mkdir(parents=True,exist_ok=True)
labels=json.loads((ML/'configs/repcount_label_map.json').read_text())
mapping=json.loads((ML/'configs/repcount_class_map.json').read_text())
names={13:'elbow',14:'elbow',25:'knee',26:'knee',23:'hip',24:'hip',11:'shoulder',12:'shoulder',27:'ankle',28:'ankle'}
def config(cls):
 c=mapping[cls]['config_snapshot']; j=names[c['primary_joints'][1]]; joints=['left_'+j,'right_'+j]; mode=c['side_mode']; mode=mode if mode in ['bilateral','alternating','unilateral'] else 'unilateral'
 return dict(primaryJoints=joints if mode!='unilateral' else joints[:1],sideMode=mode,startAngles=dict.fromkeys(joints,c['start_angle']),peakAngles=dict.fromkeys(joints,c['peak_angle']),directions=dict.fromkeys(joints,'decreasing' if c['peak_angle']<c['start_angle'] else 'increasing'),referenceRanges=dict.fromkeys(joints,abs(c['peak_angle']-c['start_angle'])),stabilityConstraints=[],viewHint='unknown')
def extract(path,target):
 cap=cv2.VideoCapture(str(path)); fps=cap.get(cv2.CAP_PROP_FPS)
 if fps<=0: raise RuntimeError('Invalid video FPS: '+str(path))
 options=mp.tasks.vision.PoseLandmarkerOptions(base_options=mp.tasks.BaseOptions(model_asset_path=str(ML/'models/pose_landmarker_lite.task')),running_mode=mp.tasks.vision.RunningMode.VIDEO,min_pose_detection_confidence=.6,min_pose_presence_confidence=.6,min_tracking_confidence=.6)
 frames=[]; times=[]; detected=[]; index=0; next_sample=0
 with mp.tasks.vision.PoseLandmarker.create_from_options(options) as detector:
  while True:
   ok,bgr=cap.read()
   if not ok: break
   t=index*1000/fps; index+=1
   if t+1e-6<next_sample: continue
   next_sample+=1000/15
   h,w=bgr.shape[:2]; width=min(480,w); height=max(1,round(h*width/w)); rgb=np.ascontiguousarray(cv2.cvtColor(cv2.resize(bgr,(width,height)),cv2.COLOR_BGR2RGB),dtype=np.uint8)
   result=detector.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB,data=rgb),round(t))
   frames.append([[p.x,p.y,p.z,p.visibility] for p in result.pose_landmarks[0]] if result.pose_landmarks else np.zeros((33,4)).tolist()); times.append(t); detected.append(bool(result.pose_landmarks))
 cap.release()
 if not frames: raise RuntimeError('No decoded frames: '+str(path))
 np.savez_compressed(target,landmarks=np.array(frames),timestamps_ms=times,detection_mask=detected,width=width,height=height,source_width=w,source_height=h,fps=fps)
def summary(rows):
 out={}
 for cls in ['ALL']+sorted(mapping):
  r=rows if cls=='ALL' else [x for x in rows if x['class']==cls]
  if not r: continue
  err=np.array([abs(x['count']-x['gt']) for x in r]); out[cls]={'n':len(r),'mae':float(err.mean()),'exact_pct':float((err==0).mean()*100),'within1_pct':float((err<=1).mean()*100),'detection_pct':100*sum(x['detected'] for x in r)/sum(x['frames'] for x in r)}
 return out
def plot(row,phase):
 data=np.load(CACHE/f"{phase}_{row['id']}.npz"); angles=json.loads((OUT/f"{phase}_{row['id']}.json").read_text())['smoothedAngles']
 fig,ax=plt.subplots(); ax.plot(data['timestamps_ms']/1000,[np.nan if x is None else x for x in angles]);
 for b in json.loads(row['cycle_bounds_json']):
  if isinstance(b,(int,float)) and b>=0: ax.axvline(b/data['fps'],alpha=.12,color='red')
 ax.set(title=f"{row['id']} {row['class']} counted={row['count']} GT={row['gt']}",xlabel='seconds',ylabel='smoothed degrees'); fig.tight_layout(); fig.savefig(OUT/f"{phase}_{row['id']}.png"); plt.close(fig)
all_results={}; exclusions={}; coordinate=None
for phase in ['validation','test']:
 if phase=='test':
  freeze={'thresholds':'GenericRepCounter defaults, calibration=true','tuning':'none; DEV inspected without parameter changes','map_sha256':hashlib.sha256((ML/'configs/repcount_class_map.json').read_bytes()).hexdigest(),'counter_sha256':hashlib.sha256((ML.parent/'shared/genericRepCounter.ts').read_bytes()).hexdigest()}
  (OUT/'frozen_settings.json').write_text(json.dumps(freeze,indent=2))
 ds=lance.dataset(f'hf://datasets/lmms-lab-eval/repcounta-lance/data/{phase}.lance')
 meta=ds.to_table(columns=['video_id','source_name','action_type','count','cycle_bounds_json','video_ext']).to_pylist(); results=[]; exclusions[phase]={}
 with (OUT/f'{phase}_manifest.csv').open('w',newline='',encoding='utf-8') as f:
  writer=csv.DictWriter(f,fieldnames=list(meta[0])); writer.writeheader(); writer.writerows(meta)
 for i,row in enumerate(meta):
  cls=labels[row['action_type']]
  if cls=='excluded': exclusions[phase][row['action_type']]=exclusions[phase].get(row['action_type'],0)+1; continue
  vid=row['video_id']; video=RAW/f'{phase}_{vid}{row["video_ext"] if row["video_ext"].startswith(".") else "."+row["video_ext"]}'; cache=CACHE/f'{phase}_{vid}.npz'; output=OUT/f'{phase}_{vid}.json'
  if not video.exists():
   blob=ds.take_blobs('video_blob',indices=[i])[0]; payload=blob.read(); video.write_bytes(payload)
  if not cache.exists(): extract(video,cache)
  data=np.load(cache); aspect=float(data['width'])/float(data['height'])
  if output.exists(): result=json.loads(output.read_text())
  else:
   result=count_landmarks(data['landmarks'],data['timestamps_ms'],aspect,config(cls),{'calibration':True}); output.write_text(json.dumps(result))
  results.append(dict(id=vid,**{'class':cls},gt=row['count'],count=result['count'],detected=int(data['detection_mask'].sum()),frames=len(data['timestamps_ms']),cycle_bounds_json=row['cycle_bounds_json']))
  if coordinate is None and abs(float(data['source_width'])/float(data['source_height'])-16/9)<.01:
   ids=mapping[cls]['config_snapshot']['primary_joints']; k=next((k for k,p in enumerate(data['landmarks']) if min(p[ids,3])>=.5),None)
   if k is not None:
    p=data['landmarks'][k]; a,b,c=p[ids,:2]; v=(a-b)*[aspect,1]; u=(c-b)*[aspect,1]; raw=float(np.degrees(np.arccos(np.clip(v@u/(np.linalg.norm(v)*np.linalg.norm(u)),-1,1)))); cfg=config(cls); joint=('right_' if ids[1]%2==0 else 'left_')+names[ids[1]]; cfg['primaryJoints']=[joint]; cfg['sideMode']='unilateral'; measured=count_landmarks(p[None],[0],aspect,cfg,{'emaAlpha':1})['smoothedAngles'][0]; coordinate={'id':vid,'raw':raw,'harness':measured,'difference':abs(raw-measured)}
  print(phase,i+1,len(meta),vid,'count',result['count'],'gt',row['count'],flush=True)
 (OUT/f'{phase}_results.json').write_text(json.dumps(results,indent=2)); stats=summary(results); all_results[phase]=stats; print(phase,json.dumps(stats),flush=True)
 worst=sorted(results,key=lambda r:abs(r['count']-r['gt']),reverse=True)
 selected=worst[:5] if phase=='test' else [r for cls in mapping for r in [x for x in worst if x['class']==cls][:5]]
 for row in selected: plot(row,phase)
 (OUT/f'{phase}_worst.json').write_text(json.dumps(selected,indent=2))
report={'metrics':all_results,'excluded':exclusions,'coordinate_check':coordinate,'protocol':'DEV as configured; no tuning; TEST once with frozen defaults','reliable_test_classes':[k for k,v in all_results['test'].items() if k!='ALL' and v['within1_pct']>=70]}
(OUT/'FINAL_REPORT.json').write_text(json.dumps(report,indent=2)); print('FINAL_REPORT',json.dumps(report),flush=True)
