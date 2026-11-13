import json
import subprocess
import sys
from pathlib import Path

import numpy as np

ML = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ML / 'src'))
from pq_ml.rep_harness import count_landmarks


def test_json_and_npy_use_real_counter(tmp_path):
    config = {'primaryJoints':['left_knee'],'sideMode':'unilateral','startAngles':{'left_knee':160},'peakAngles':{'left_knee':80},'directions':{'left_knee':'decreasing'},'referenceRanges':{'left_knee':80},'stabilityConstraints':[],'viewHint':'side'}
    frames = []
    for angle in [160,140,120,100,80,80,100,120,140,160,160]:
        frame = np.ones((33,4),dtype=np.float32); frame[:,:3]=0
        radians=np.radians(angle)
        frame[23,:2]=[1,0]; frame[25,:2]=[0,0]; frame[27,:2]=[np.cos(radians),np.sin(radians)]
        frames.append(frame)
    frames = np.array(frames); timestamps=np.arange(len(frames))*100
    from_python=count_landmarks(frames,timestamps,1,config,{'emaAlpha':1,'calibration':False})
    assert from_python['count']==1
    assert len(from_python['reps'])==1 and len(from_python['smoothedAngles'])==len(frames)
    np.save(tmp_path/'frames.npy',frames)
    payload={'landmarks':'frames.npy','timestamps':timestamps.tolist(),'aspect':1,'angleConfig':config,'counterConfig':{'emaAlpha':1,'calibration':False}}
    (tmp_path/'input.json').write_text(json.dumps(payload),encoding='utf-8')
    result=subprocess.run(['node',str(ML/'scripts/rep_harness.mjs'),str(tmp_path/'input.json')],capture_output=True,text=True,check=True)
    assert json.loads(result.stdout)==from_python
