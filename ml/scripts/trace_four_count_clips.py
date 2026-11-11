"""Trace the first ten 4-of-5 GIF results frame-by-frame through TS."""
import json
from pathlib import Path
import subprocess
import numpy as np

ML = Path(__file__).resolve().parents[1]
report = ML/'reports/gif_harness'
out = ML/'reports/p1_traces_before'; out.mkdir(parents=True,exist_ok=True)
rows=json.loads((report/'tile_results.json').read_text(encoding='utf-8'))
configs={c['exercise_id']:c for c in json.loads((report/'candidate_configs.json').read_text(encoding='utf-8'))}
mapping=json.loads((ML/'data/exercise_ml_map.json').read_text(encoding='utf-8'))
joint_names={(23,25,27):'knee',(11,13,15):'elbow',(11,23,25):'hip',(25,27,31):'ankle',(23,11,13):'shoulder'}
print('clip,tile_event_counts,loss_class,frames')
for row in [r for r in rows if r['count']==4][:10]:
    eid=row['exercise_id']; data=np.load(ML/'data/keypoints_raw_gif'/f'{eid}.npz'); cfg=configs[eid]; info=mapping[eid]['rep_signal']
    raw=data['landmarks'].astype(float); times=data['timestamps_ms']; durations=data['durations_ms'].copy()
    if len(durations)>1 and durations[-1]>=500: durations[-1]=min(durations[-1],float(np.median(durations[:-1])))
    end=float(times[-1]+durations[-1]); samples=np.arange(0,end,1000/15); frames=np.zeros((len(samples),33,4))
    for i,t in enumerate(samples):
        before=min(int(np.searchsorted(times,t,side='right')-1),len(times)-1); after=min(before+1,len(times)-1)
        if not data['detection_mask'][before] or not data['detection_mask'][after]: continue
        f=0 if before==after else (t-times[before])/(times[after]-times[before]); frames[i]=raw[before]*(1-f)+raw[after]*f
    name=joint_names.get(tuple(cfg['primary_joints']),'unsupported'); joints=[f'left_{name}',f'right_{name}']; mode=cfg['side_mode']; use=joints if mode!='unilateral' else joints[:1]
    start=cfg['start_angle']; peak=cfg['peak_angle']; direction='decreasing' if peak<start else 'increasing'
    angle_config={'primaryJoints':use,'sideMode':mode,'startAngles':dict.fromkeys(joints,start),'peakAngles':dict.fromkeys(joints,peak),'directions':dict.fromkeys(joints,direction),'referenceRanges':dict.fromkeys(joints,abs(peak-start)),'stabilityConstraints':[],'viewHint':'unknown','isIsometric':bool(info.get('is_isometric',False))}
    payload={'landmarks':np.tile(frames,(5,1,1)).tolist(),'timestamps':np.concatenate([samples+k*end for k in range(5)]).tolist(),'aspect':float(data['width'])/float(data['height']),'angleConfig':angle_config,'trace':True}
    proc=subprocess.run(['node',str(ML/'scripts/rep_harness.mjs'),'-'],input=json.dumps(payload),capture_output=True,text=True,check=True)
    result=json.loads(proc.stdout)
    assert result['count']==4, (eid,result['count'])
    per=[0]*5
    for frame in result['trace']:
        tile=min(4,int(frame['timestamp']/end)); frame['tile']=tile+1
        per[tile]+=sum(e['type']=='rep_counted' for e in frame['events'])
    # Event tile alone is not the rep's tile: a completion may cross a seam.
    first_peak=next((f['timestamp'] for f in result['trace'] if f['state']=='AT_PEAK'),None)
    label='seam; final unfinished' if first_peak is not None and first_peak < end and result['trace'][-1]['state']=='AT_PEAK' else 'ambiguous'
    (out/f'{eid}.json').write_text(json.dumps({'tileDurationMs':end,'countsByTile':per,'lossClass':label,'frames':result['trace']},indent=2),encoding='utf-8')
    print(f'{eid},{"/".join(map(str,per))},{label},{len(result["trace"])}')
