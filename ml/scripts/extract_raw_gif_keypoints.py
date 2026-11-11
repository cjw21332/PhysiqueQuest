"""Re-extract GIF frames with image-normalized landmarks and original durations.

The older keypoints_cached files are torso-normalized and were resampled with
assumed timing. This produces a separate cache without overwriting them.
"""
import json
from pathlib import Path
import time

import mediapipe as mp
import numpy as np
from PIL import Image, ImageSequence

ML = Path(__file__).resolve().parents[1]
OUT = ML / 'data/keypoints_raw_gif'
OUT.mkdir(parents=True, exist_ok=True)
manifest = json.loads((ML / 'data/manifests/combined_manifest.json').read_text(encoding='utf-8'))
opts = mp.tasks.vision.PoseLandmarkerOptions(base_options=mp.tasks.BaseOptions(model_asset_path=str(ML / 'models/pose_landmarker_lite.task')), running_mode=mp.tasks.vision.RunningMode.IMAGE, min_pose_detection_confidence=.3, min_pose_presence_confidence=.3, min_tracking_confidence=.3)
start = time.monotonic()
ok = errors = 0
with mp.tasks.vision.PoseLandmarker.create_from_options(opts) as detector:
    for index, entry in enumerate(manifest):
        target = OUT / f"{entry['exercise_id']}.npz"
        if target.exists(): ok += 1; continue
        try:
            gif = ML / Path(entry['file_path'])
            with Image.open(gif) as source:
                durations = []; frames = []
                for frame in ImageSequence.Iterator(source):
                    duration = float(frame.info.get('duration', source.info.get('duration', 0)))
                    if duration <= 0: raise ValueError('GIF frame duration missing')
                    rgba = frame.convert('RGBA'); bg = Image.new('RGBA', rgba.size, (255,255,255,255))
                    frames.append(Image.alpha_composite(bg,rgba).convert('RGB'))
                    durations.append(duration)
            if not frames: raise ValueError('empty GIF')
            w,h = frames[0].size; pw,ph = int(w*1.5),int(h*1.5); ox,oy = int(w*.25),int(h*.25)
            landmarks = []; mask = []
            for frame in frames:
                canvas = Image.new('RGB',(pw,ph),frame.getpixel((0,0))); canvas.paste(frame,(ox,oy))
                image = mp.Image(image_format=mp.ImageFormat.SRGB,data=np.ascontiguousarray(np.array(canvas,dtype=np.uint8)))
                result = detector.detect(image)
                if result.pose_landmarks:
                    points = np.array([[p.x,p.y,p.z,p.visibility] for p in result.pose_landmarks[0]],dtype=np.float32)
                    points[:,0] = (points[:,0]*pw-ox)/w; points[:,1] = (points[:,1]*ph-oy)/h; points[:,2] *= pw/w
                    landmarks.append(points); mask.append(True)
                else: landmarks.append(np.zeros((33,4),dtype=np.float32)); mask.append(False)
            np.savez_compressed(target, landmarks=np.array(landmarks), durations_ms=np.array(durations), timestamps_ms=np.r_[0,np.cumsum(durations)[:-1]], detection_mask=np.array(mask), width=w, height=h)
            ok += 1
        except Exception as exc:
            errors += 1
            print(f"ERROR {entry['exercise_id']}: {exc}",flush=True)
        if (index + 1) % 50 == 0:
            print(f'processed={index+1}/{len(manifest)} ok={ok} errors={errors} elapsed_s={time.monotonic()-start:.1f}',flush=True)
print(f'complete total={len(manifest)} ok={ok} errors={errors} elapsed_s={time.monotonic()-start:.1f}',flush=True)
