#!/usr/bin/env python3
"""Stuck-state diagnosis: dump progress curve + counter state over time for videos with duration_too_long rejection"""

import json, numpy as np, subprocess, sys
from pathlib import Path

ML = Path(__file__).resolve().parents[1]
CACHE = ML / 'data' / 'keypoints_repcount'
OUT = ML / 'reports' / 'repcount' / 'stuck_diagnosis'
OUT.mkdir(parents=True, exist_ok=True)

mapping = json.load(open(ML / 'configs' / 'repcount_class_map.json'))
labels = json.load(open(ML / 'configs' / 'repcount_label_map.json'))

JOINT_NAMES = {11: 'shoulder', 12: 'shoulder', 13: 'elbow', 14: 'elbow', 23: 'hip', 24: 'hip', 25: 'knee', 26: 'knee', 27: 'ankle', 28: 'ankle'}

def build_angle_config(cls):
    cfg = mapping[cls]['config_snapshot']
    joint_name = JOINT_NAMES[cfg['primary_joints'][1]]
    joints = [f'left_{joint_name}', f'right_{joint_name}']
    mode = cfg['side_mode'] if cfg['side_mode'] in ['bilateral', 'alternating', 'unilateral'] else 'unilateral'
    direction = 'decreasing' if cfg['peak_angle'] < cfg['start_angle'] else 'increasing'
    return {
        'primaryJoints': joints,
        'sideMode': mode,
        'startAngles': dict.fromkeys(joints, cfg['start_angle']),
        'peakAngles': dict.fromkeys(joints, cfg['peak_angle']),
        'directions': dict.fromkeys(joints, direction),
        'referenceRanges': dict.fromkeys(joints, abs(cfg['peak_angle'] - cfg['start_angle'])),
        'stabilityConstraints': [],
        'viewHint': 'unknown'
    }

# Videos with duration_too_long from dev analysis
stuck_videos = [
    ('stu5_5', 'validation', 'bench_press', 30),
    ('stu9_9', 'validation', 'bench_press', 12),
    ('stu7_1', 'validation', 'bench_press', 10),
    ('stu9_19', 'validation', 'front_raise', 7),
    ('stu3_16', 'validation', 'front_raise', 5),
    ('stu7_43', 'validation', 'pull_up', 23),
    ('stu5_40', 'validation', 'pull_up', 17),
    ('stu6_34', 'validation', 'pull_up', 11),
    ('stu10_44', 'validation', 'push_up', 40),
    ('stu8_43', 'validation', 'push_up', 25),
    ('stu4_40', 'validation', 'push_up', 6),
    ('stu8_52', 'validation', 'situp', 47),
    ('stu5_59', 'validation', 'situp', 36),
    ('stu1_57', 'validation', 'situp', 40),
    ('stu5_71', 'validation', 'squat', 19),
    ('stu7_66', 'validation', 'squat', 13),
    ('stu4_70', 'validation', 'squat', 44),
]

harness = ML / 'scripts' / 'rep_harness.mjs'

for video_id, phase, cls, gt in stuck_videos[:10]:  # First 10
    cache_file = CACHE / f'{phase}_{video_id}.npz'
    if not cache_file.exists():
        for prefix in ['test', 'validation']:
            alt = CACHE / f'{prefix}_{video_id}.npz'
            if alt.exists():
                cache_file = alt
                break
    if not cache_file.exists():
        print(f"SKIP {video_id}: no cache")
        continue
    
    data = np.load(cache_file, allow_pickle=True)
    landmarks = data['landmarks'].tolist()
    timestamps = data['timestamps_ms'].tolist()
    aspect = float(data['source_width'] / data['source_height'])
    angle_config = build_angle_config(cls)
    
    payload = {
        'landmarks': landmarks,
        'timestamps': timestamps,
        'aspect': aspect,
        'angleConfig': angle_config,
        'counterConfig': {'calibration': True, 'trace': True}
    }
    
    result = subprocess.run(['node', str(harness), '-'], 
                           input=json.dumps(payload, allow_nan=False),
                           capture_output=True, text=True, check=True)
    
    out = json.loads(result.stdout)
    
    # Save trace
    trace_file = OUT / f'{video_id}_{cls}_trace.json'
    with open(trace_file, 'w') as f:
        json.dump(out, f, indent=2)
    
    print(f"Saved {trace_file}: count={out['count']}, gt={gt}, events={len(out['events'])}")
    
    # Print state timeline
    if 'trace' in out:
        print(f"  Frames: {len(out['trace'])}")
        for t in out['trace'][:5]:
            print(f"    t={t['timestamp']:.0f} state={t['state']} progress={t['progress']:.2f} angle={t['angle']:.1f} count={t['count']} calRest={t.get('calibratedRest')} calPeak={t.get('calibratedPeak')}")
        print("  ...")
        for t in out['trace'][-5:]:
            print(f"    t={t['timestamp']:.0f} state={t['state']} progress={t['progress']:.2f} angle={t['angle']:.1f} count={t['count']} calRest={t.get('calibratedRest')} calPeak={t.get('calibratedPeak')}")