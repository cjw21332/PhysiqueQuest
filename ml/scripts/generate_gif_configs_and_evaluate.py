"""Generate GIF-derived priors and run five-tile tests against the TS harness.

Requires the complete raw GIF cache produced by extract_raw_gif_keypoints.py.
Writes a candidate and a detailed report; it does not overwrite production data.
"""
from collections import Counter, defaultdict
import json
from pathlib import Path
import sys

import numpy as np

ML = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ML / 'src'))
from pq_ml.rep_harness import count_landmarks

manifest = json.loads((ML / 'data/manifests/combined_manifest.json').read_text(encoding='utf-8'))
smoke = '--smoke' in sys.argv
if smoke: manifest = manifest[:1]
mapping = json.loads((ML / 'data/exercise_ml_map.json').read_text(encoding='utf-8'))
previous = {item['exercise_id']: item for item in json.loads((ML / 'models/generated_angle_configs.json').read_text(encoding='utf-8'))}
raw_dir = ML / 'data/keypoints_raw_gif'
missing = [item['exercise_id'] for item in manifest if not (raw_dir / f"{item['exercise_id']}.npz").exists()]
if missing: raise SystemExit(f'Refusing incomplete raw cache: {len(missing)} GIFs missing; first={missing[:10]}')

triplets = {
    ('hip','knee','ankle'): ('knee',(23,25,27)),
    ('shoulder','elbow','wrist'): ('elbow',(11,13,15)),
    ('shoulder','hip','knee'): ('hip',(11,23,25)),
    ('knee','ankle','foot'): ('ankle',(25,27,31)),
    ('hip','shoulder','elbow'): ('shoulder',(23,11,13)),
}

def resample(data):
    landmarks = data['landmarks'].astype(float); times = data['timestamps_ms']; durations = data['durations_ms'].copy()
    if len(durations) > 1 and durations[-1] >= 500:
        durations[-1] = min(durations[-1], float(np.median(durations[:-1])))
    end = times[-1] + durations[-1]
    samples = np.arange(0, end, 1000/15)
    result = np.zeros((len(samples),33,4),dtype=float)
    for i,t in enumerate(samples):
        before = min(int(np.searchsorted(times,t,side='right')-1),len(times)-1)
        after = min(before+1,len(times)-1)
        if not data['detection_mask'][before] or not data['detection_mask'][after]: continue
        f = 0 if before == after else (t-times[before])/(times[after]-times[before])
        result[i] = landmarks[before]*(1-f)+landmarks[after]*f
    return result, samples, end

def angles(points, indices, aspect):
    a,b,c = (points[:,i,:2] for i in indices)
    v=(a-b)*[aspect,1]; u=(c-b)*[aspect,1]
    den=np.linalg.norm(v,axis=1)*np.linalg.norm(u,axis=1)
    valid=(points[:,indices,3].min(axis=1)>=.5)&(den>1e-9)
    out=np.full(len(points),np.nan)
    out[valid]=np.degrees(np.arccos(np.clip(np.sum(v[valid]*u[valid],axis=1)/den[valid],-1,1)))
    return out

rows=[]; configs=[]; curves=[]; counts=Counter(); groups=defaultdict(list)
for index,item in enumerate(manifest):
    eid=item['exercise_id']; entry=mapping.get(eid,{}); signal=entry.get('rep_signal',{}); spec=triplets.get(tuple(signal.get('primary_joints',[])))
    prior=previous.get(eid,{}); data=np.load(raw_dir/f'{eid}.npz'); frames,times,duration=resample(data); aspect=float(data['width'])/float(data['height'])
    mode=signal.get('side_mode','unilateral'); mode=mode if mode in ('bilateral','alternating','unilateral') else 'unilateral'
    derived=False; curve=None
    if spec:
        name,ids=spec; left=angles(frames,ids,aspect); right=angles(frames,tuple(i+1 for i in ids),aspect)
        curve=left
        valid=left[np.isfinite(left)]; beginning=left[:max(1,len(left)//5)]; beginning=beginning[np.isfinite(beginning)]; ending=left[-max(1,len(left)//5):]; ending=ending[np.isfinite(ending)]
        if len(valid)>=5 and len(beginning) and len(ending):
            start=float(np.median(beginning)); low,high=np.percentile(valid,[5,95]); peak=float(low if abs(start-low)>=abs(high-start) else high)
            amplitude=abs(peak-start); round_trip=abs(float(np.median(ending))-start)<=max(15,amplitude*.3)
            derived=amplitude>=30 and round_trip and not signal.get('is_isometric',False)
    if derived:
        direction='decreasing' if peak<start else 'increasing'; source='gif'
    else:
        start=float(prior.get('start_angle',160)); peak=float(prior.get('peak_angle',80)); direction='decreasing' if peak<start else 'increasing'; source='rule'
        name=spec[0] if spec else 'unsupported'; round_trip=False
    joints=[f'left_{name}',f'right_{name}']; use=joints if mode!='unilateral' else joints[:1]
    cfg={'primaryJoints':use,'sideMode':mode,'startAngles':dict.fromkeys(joints,start),'peakAngles':dict.fromkeys(joints,peak),'directions':dict.fromkeys(joints,direction),'referenceRanges':dict.fromkeys(joints,abs(peak-start)),'stabilityConstraints':[],'viewHint':'unknown','isIsometric':bool(signal.get('is_isometric',False))}
    tiled=np.tile(frames,(5,1,1)); tiled_times=np.concatenate([times+k*duration for k in range(5)])
    result=count_landmarks(tiled,tiled_times,aspect,cfg)
    pattern=entry.get('movement_pattern','unknown'); exact=result['count']==5
    counts[source]+=1; groups[pattern].append(exact)
    rows.append({'exercise_id':eid,'pattern':pattern,'parameter_source':source,'count':result['count'],'expected':5,'exact':exact,'unsupported_triplet':spec is None})
    configs.append({**prior,'exercise_id':eid,'pattern':pattern,'primary_joints':list(spec[1]) if spec else prior.get('primary_joints',[]),'start_angle':start,'peak_angle':peak,'direction':'flexion' if direction=='decreasing' else 'extension','round_trip':round_trip,'rep_period_seconds':duration/1000,'side_mode':mode,'source':source,'parameter_source':source,'validation_status':'pending','validationStatus':'pending'})
    if len(curves)<10 and curve is not None: curves.append((eid,times,curve))
    if (index+1)%50==0: print(f'evaluated={index+1}/{len(manifest)}',flush=True)

if not smoke:
    present={config['exercise_id'] for config in configs}
    for eid,prior in previous.items():
        if eid not in present: configs.append({**prior,'source':'rule','parameter_source':'rule','validation_status':'pending','validationStatus':'pending'})
out=ML/('reports/gif_harness_smoke' if smoke else 'reports/gif_harness'); out.mkdir(parents=True,exist_ok=True)
(out/'candidate_configs.json').write_text(json.dumps(configs,indent=2),encoding='utf-8')
(out/'tile_results.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')
print('parameter_source,count'); [print(f'{k},{v}') for k,v in sorted(counts.items())]
print('pattern,exact,total,exact_pct'); [print(f'{k},{sum(v)},{len(v)},{100*sum(v)/len(v):.1f}') for k,v in sorted(groups.items())]
print('failing_exercises'); [print(f"{r['exercise_id']},{r['pattern']},{r['count']}") for r in rows if not r['exact']]
try:
    import matplotlib.pyplot as plt
    for eid,t,curve in curves:
        fig,ax=plt.subplots(); ax.plot(t/1000,curve); ax.set(xlabel='time (s)',ylabel='joint angle (degrees)',title=eid); fig.tight_layout(); fig.savefig(out/f'{eid}.png'); plt.close(fig)
except ImportError:
    print('plots unavailable: matplotlib not installed',file=sys.stderr)
