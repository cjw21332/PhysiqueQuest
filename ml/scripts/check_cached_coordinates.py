"""Compare cached first frames with fresh MediaPipe detection of their source GIFs."""
import json
from pathlib import Path
import sys

import mediapipe as mp
import numpy as np
from PIL import Image

ML = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ML / 'src'))
from pq_ml.rep_harness import count_landmarks

model = ML / 'models' / 'pose_landmarker_lite.task'
opts = mp.tasks.vision.PoseLandmarkerOptions(base_options=mp.tasks.BaseOptions(model_asset_path=str(model)), running_mode=mp.tasks.vision.RunningMode.IMAGE, min_pose_detection_confidence=.3, min_pose_presence_confidence=.3, min_tracking_confidence=.3)
config = {'primaryJoints':['left_knee'], 'sideMode':'unilateral', 'startAngles':{'left_knee':160}, 'peakAngles':{'left_knee':80}, 'directions':{'left_knee':'decreasing'}, 'referenceRanges':{'left_knee':80}, 'stabilityConstraints':[], 'viewHint':'side'}
manifest = json.loads((ML / 'data/manifests/combined_manifest.json').read_text(encoding='utf-8'))
print('clip,aspect,raw_angle,cached_harness_angle,abs_diff_deg')
found = 0
with mp.tasks.vision.PoseLandmarker.create_from_options(opts) as detector:
    for entry in manifest:
        cache = ML / 'data/keypoints_cached' / (entry['exercise_id'] + '.npz')
        gif = ML / Path(entry['file_path'])
        if not cache.exists() or not gif.exists(): continue
        with Image.open(gif) as im:
            rgb = im.convert('RGBA'); bg = Image.new('RGBA', rgb.size, (255,255,255,255)); im = Image.alpha_composite(bg,rgb).convert('RGB')
        w,h = im.size
        canvas = Image.new('RGB',(int(w*1.5),int(h*1.5)),im.getpixel((0,0)))
        canvas.paste(im,(int(w*.25),int(h*.25)))
        result = detector.detect(mp.Image(image_format=mp.ImageFormat.SRGB,data=np.ascontiguousarray(np.array(canvas,dtype=np.uint8))))
        if not result.pose_landmarks: continue
        raw = np.array([[p.x,p.y,p.z,p.visibility] for p in result.pose_landmarks[0]],dtype=np.float32)
        raw[:,:2] = raw[:,:2]*1.5-.25
        cached = np.load(cache)['landmarks'][0]
        if min(raw[[23,25,27],3]) < .5 or min(cached[[23,25,27],3]) < .5: continue
        a,b,c = raw[[23,25,27],:2].astype(float); v=(a-b)*[w/h,1]; u=(c-b)*[w/h,1]
        raw_angle = np.degrees(np.arccos(np.clip(v@u/(np.linalg.norm(v)*np.linalg.norm(u)), -1,1)))
        angle = count_landmarks(cached[None],[0],w/h,config,{'emaAlpha':1})['smoothedAngles'][0]
        if angle is None: continue
        print(f"{entry['exercise_id']},{w/h:.6f},{raw_angle:.6f},{angle:.6f},{abs(raw_angle-angle):.6f}", flush=True)
        found += 1
        if found == 5: break
if found < 5: raise SystemExit(f'Only {found} usable comparisons')
