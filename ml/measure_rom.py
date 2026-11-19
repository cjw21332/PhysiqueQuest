import numpy as np
from pathlib import Path
import json

LANDMARK_MAP = {'shoulder': 11, 'elbow': 13, 'wrist': 15, 'hip': 23, 'knee': 25, 'ankle': 27}

def get_angle(a, b, c):
    ba = a - b
    bc = c - b
    cosine_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-6)
    angle = np.arccos(np.clip(cosine_angle, -1.0, 1.0))
    return np.degrees(angle)

DATA = Path('ml/data/keypoints_cached')
catalog = json.load(open('ml/data/exercise_ml_map.json', encoding='utf-8'))

measured_low_rom = 0
total_checked = 0

for ex_id, ex in catalog.items():
    p = DATA / f"{ex_id}.npz"
    if not p.exists(): continue

    try:
        data = np.load(p)
        lm = data['landmarks']
        joints = ex.get('rep_signal', {}).get('primary_joints', [])
        if not joints or len(joints) < 3: continue

        idx = [LANDMARK_MAP.get(j) for j in joints if j in LANDMARK_MAP]
        if len(idx) < 3: continue

        angles = []
        valid_frames = 0
        total_frames = lm.shape[0]
        if total_frames == 0: continue

        for f in range(total_frames):
            a = lm[f, idx[0], :3]
            b = lm[f, idx[1], :3]
            c = lm[f, idx[2], :3]
            conf = min(lm[f, idx[0], 3], lm[f, idx[1], 3], lm[f, idx[2], 3])
            if conf > 0.3:
                valid_frames += 1
            angles.append(get_angle(a, b, c))

        if (valid_frames / total_frames) < 0.6: continue

        angles = np.array(angles)
        total_checked += 1
        if len(angles) > 5:
            p5, p95 = np.percentile(angles, [5, 95])
            if (p95 - p5) < 30:
                measured_low_rom += 1
    except: continue

print(f"Total checked with >=60% valid frames: {total_checked}")
print(f"measured_low_rom_2d: {measured_low_rom}")
