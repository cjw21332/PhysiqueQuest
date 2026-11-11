"""
Reproducible evaluation pipeline for PhysiqueQuest RepCount.

Features:
1. Extracts keypoints from videos with MediaPipe LITE (if not cached)
2. Counts reps via TypeScript GenericRepCounter harness
3. Produces per-class metrics (MAE, normalized MAE, exact %, within ±1%, detection rate, mean signed error) against ground truth
4. Runs harness-vs-raw angle check on one 16:9 clip
5. Provides detailed failure analysis for TRAIN split (758 videos)
6. Supports VALIDATION, TEST, and TRAIN phases

Usage:
  python eval_repcount.py                    # Runs entire evaluation pipeline (val + test + train)
  python eval_repcount.py --mode=validation  # Runs validation only
  python eval_repcount.py --mode=test        # Runs test only (once, with frozen settings)
  python eval_repcount.py --mode=train       # Runs TRAIN failure analysis only
"""

import csv, hashlib, json, sys, time, os, argparse, math, subprocess
from pathlib import Path
from collections import defaultdict, Counter
import numpy as np
import cv2
import mediapipe as mp
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ML = Path(__file__).resolve().parents[1]
OUT = ML / 'reports' / 'repcount'
RAW = ML / 'data' / 'raw' / 'repcount'
CACHE = ML / 'data' / 'keypoints_repcount'

# Import the shared Python harness
try:
    sys.path.insert(0, str(ML / 'src'))
    from pq_ml.rep_harness import count_landmarks
    HAS_PY_HARNESS = True
except Exception:
    HAS_PY_HARNESS = False

# Joint index to name mapping
JOINT_NAMES = {
    11: 'shoulder', 12: 'shoulder',
    13: 'elbow', 14: 'elbow',
    23: 'hip', 24: 'hip',
    25: 'knee', 26: 'knee',
    27: 'ankle', 28: 'ankle'
}

# Candidate joint triplets for analysis (center joint -> name, side joints)
CANDIDATE_JOINTS = {
    'shoulder': {'left': (13, 11, 23), 'right': (14, 12, 24)},  # elbow-shoulder-hip
    'elbow': {'left': (11, 13, 15), 'right': (12, 14, 16)},     # shoulder-elbow-wrist
    'hip': {'left': (11, 23, 25), 'right': (12, 24, 26)},        # shoulder-hip-knee
    'knee': {'left': (23, 25, 27), 'right': (24, 26, 28)},       # hip-knee-ankle
    'ankle': {'left': (25, 27, 31), 'right': (26, 28, 32)},      # knee-ankle-foot
}

# Physically plausible signal candidates per class (for F4)
PLAUSIBLE_SIGNALS = {
    'jumping_jack': [
        ('shoulder', 'abduction', 'hip-shoulder-elbow'),
        ('wrist', 'height_vs_head', 'wrist-relative-to-head'),
    ],
    'push_up': [
        ('elbow', 'flexion', 'shoulder-elbow-wrist'),
        ('shoulder', 'flexion', 'hip-shoulder-elbow'),
    ],
    'bench_press': [
        ('elbow', 'flexion', 'shoulder-elbow-wrist'),  # hip NOT allowed
    ],
    'situp': [
        ('hip', 'flexion', 'shoulder-hip-knee'),
        ('torso', 'angle_to_horizontal', 'shoulder-hip-knee'),
    ],
    'squat': [
        ('knee', 'flexion', 'hip-knee-ankle'),
        ('hip', 'flexion', 'shoulder-hip-knee'),
    ],
    'front_raise': [
        ('shoulder', 'abduction', 'hip-shoulder-elbow'),
    ],
    'pull_up': [
        ('elbow', 'flexion', 'shoulder-elbow-wrist'),
        ('shoulder', 'flexion', 'hip-shoulder-elbow'),
    ],
}

def json_safe(obj):
    """Convert numpy types and other non-JSON-serializable objects to Python native types."""
    if isinstance(obj, (np.integer, np.floating)):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, dict):
        return {k: json_safe(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [json_safe(v) for v in obj]
    elif isinstance(obj, tuple):
        return tuple(json_safe(v) for v in obj)
    return obj

def load_configs():
    """Load class configs and label map."""
    with open(ML / 'configs' / 'repcount_class_map.json') as f:
        mapping = json.load(f)
    with open(ML / 'configs' / 'repcount_label_map.json') as f:
        labels = json.load(f)
    return mapping, labels

def build_angle_config(cls, mapping, labels):
    """Build angle config for a class from config_snapshot."""
    cfg = mapping[cls]['config_snapshot']
    joint_name = JOINT_NAMES[cfg['primary_joints'][1]]  # center joint
    joints = [f'left_{joint_name}', f'right_{joint_name}']
    mode = cfg['side_mode'] if cfg['side_mode'] in ['bilateral', 'alternating', 'unilateral'] else 'unilateral'
    direction = 'decreasing' if cfg['peak_angle'] < cfg['start_angle'] else 'increasing'
    
    return {
        'primaryJoints': joints if mode != 'unilateral' else joints[:1],
        'sideMode': mode,
        'startAngles': dict.fromkeys(joints if mode != 'unilateral' else joints[:1], cfg['start_angle']),
        'peakAngles': dict.fromkeys(joints if mode != 'unilateral' else joints[:1], cfg['peak_angle']),
        'directions': dict.fromkeys(joints if mode != 'unilateral' else joints[:1], direction),
        'referenceRanges': dict.fromkeys(joints if mode != 'unilateral' else joints[:1], abs(cfg['peak_angle'] - cfg['start_angle'])),
        'stabilityConstraints': [],
        'viewHint': 'unknown'
    }

def extract_keypoints(video_path, output_cache_path):
    """Extract keypoints using MediaPipe LITE."""
    cap = cv2.VideoCapture(str(video_path))
    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0:
        raise RuntimeError(f'Invalid video FPS: {video_path}')
    
    options = mp.tasks.vision.PoseLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(ML / 'models' / 'pose_landmarker_lite.task')),
        running_mode=mp.tasks.vision.RunningMode.VIDEO,
        min_pose_detection_confidence=0.6,
        min_pose_presence_confidence=0.6,
        min_tracking_confidence=0.6
    )
    
    frames = []
    times = []
    detected = []
    index = 0
    next_sample = 0
    
    with mp.tasks.vision.PoseLandmarker.create_from_options(options) as detector:
        while True:
            ok, bgr = cap.read()
            if not ok:
                break
            t = index * 1000 / fps
            index += 1
            if t + 1e-6 < next_sample:
                continue
            next_sample += 1000 / 15  # 15 FPS sampling
            
            h, w = bgr.shape[:2]
            width = min(480, w)
            height = max(1, round(h * width / w))
            rgb = np.ascontiguousarray(cv2.cvtColor(cv2.resize(bgr, (width, height)), cv2.COLOR_BGR2RGB), dtype=np.uint8)
            
            result = detector.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), round(t))
            
            if result.pose_landmarks:
                frames.append([[p.x, p.y, p.z, p.visibility] for p in result.pose_landmarks[0]])
            else:
                frames.append(np.zeros((33, 4)).tolist())
            times.append(t)
            detected.append(bool(result.pose_landmarks))
    
    cap.release()
    
    if not frames:
        raise RuntimeError(f'No decoded frames: {video_path}')
    
    np.savez_compressed(
        output_cache_path,
        landmarks=np.array(frames),
        timestamps_ms=times,
        detection_mask=np.array(detected),
        width=width,
        height=height,
        source_width=w,
        source_height=h,
        fps=fps
    )
    
    return frames, times, detected, width, height, w, h, fps

def count_landmarks_from_harness(landmarks, timestamps_ms, aspect, angle_config, counter_config=None):
    """Call the TypeScript rep counter from Python."""
    try:
        return count_landmarks(landmarks, timestamps_ms, aspect, angle_config, counter_config)
    except Exception:
        harness_path = ML / 'scripts' / 'rep_harness.mjs'
        payload = {
            'landmarks': np.asarray(landmarks).tolist(),
            'timestamps': np.asarray(timestamps_ms).tolist(),
            'aspect': float(aspect),
            'angleConfig': angle_config,
            'counterConfig': counter_config or {'calibration': True},
        }
        node_path = 'node'
        result = subprocess.run([node_path, str(harness_path), '-'],
                               input=json.dumps(payload, allow_nan=False),
                               capture_output=True, text=True, check=True)
        return json.loads(result.stdout)

def compute_joint_angle(landmarks, center_idx, side1_idx, side2_idx):
    """Compute angle at center joint across all frames."""
    center = landmarks[:, center_idx, 0:2]
    side1 = landmarks[:, side1_idx, 0:2]
    side2 = landmarks[:, side2_idx, 0:2]
    
    v1 = side1 - center
    v2 = side2 - center
    
    dot = np.sum(v1 * v2, axis=1)
    norm_v1 = np.linalg.norm(v1, axis=1)
    norm_v2 = np.linalg.norm(v2, axis=1)
    
    cos_theta = dot / (norm_v1 * norm_v2 + 1e-8)
    cos_theta = np.clip(cos_theta, -1, 1)
    angles = np.degrees(np.arccos(cos_theta))
    return angles

def compute_rom(angles):
    """Compute Range of Motion (max - min) of angle series."""
    return float(np.max(angles) - np.min(angles))

def wilson_ci(k, n, confidence=0.95):
    """Wilson score interval for binomial proportion."""
    if n == 0:
        return (0.0, 1.0)
    from math import sqrt
    z = 1.96  # 95%
    p = k / n
    denominator = 1 + z**2 / n
    centre = (p + z**2 / (2*n)) / denominator
    half = (z * sqrt(p*(1-p)/n + z**2/(4*n*n))) / denominator
    return (max(0.0, centre - half), min(1.0, centre + half))

def load_manifest_with_splits(phase):
    """Load manifest and add split column based on video_id prefix."""
    manifest_path = OUT / f'{phase}_manifest.csv'
    
    if not manifest_path.exists():
        print(f"ERROR: Manifest not found: {manifest_path}")
        return None
    
    with open(manifest_path, newline='') as f:
        reader = csv.DictReader(f)
        meta = list(reader)
    
    # Assign split based on video_id prefix
    for row in meta:
        vid = row['video_id']
        if vid.startswith('train'):
            row['split'] = 'train'
        elif vid.startswith('test'):
            row['split'] = 'test'
        elif vid.startswith('val'):
            row['split'] = 'val'
        elif vid.startswith('stu'):
            # These are from the main dataset, assign based on original split info
            # For now, use the phase they appear in
            row['split'] = phase
        else:
            row['split'] = 'unknown'
    
    return meta

def run_validation_test_phase(phase, mapping, labels, frozen_settings=None):
    """Run evaluation for validation or test phase using cached keypoints."""
    meta = load_manifest_with_splits(phase)
    
    if not meta:
        return None
    
    print(f"Phase: {phase}, videos in manifest: {len(meta)}")
    
    results = []
    exclusions = defaultdict(int)
    coordinate_check = None
    
    for i, row in enumerate(meta):
        action_type = row['action_type']
        cls = labels.get(action_type, 'excluded')
        if cls == 'excluded':
            exclusions[action_type] += 1
            continue
        
        vid = row['video_id']
        gt_count = int(row['count'])
        cycle_bounds = row['cycle_bounds_json']
        split = row.get('split', 'unknown')
        
        # Find cache file
        cache_file = CACHE / f'{phase}_{vid}.npz'
        if not cache_file.exists():
            for prefix in ['test', 'validation']:
                alt = CACHE / f'{prefix}_{vid}.npz'
                if alt.exists():
                    cache_file = alt
                    break
        
        if not cache_file.exists():
            print(f"  WARNING: No cache for {vid}, skipping")
            continue
        
        # Load cached data
        data = np.load(cache_file, allow_pickle=True)
        landmarks = data['landmarks']
        timestamps_ms = data['timestamps_ms']
        detection_mask = data['detection_mask']
        width = data['width']
        height = data['height']
        source_width = data['source_width']
        source_height = data['source_height']
        fps = data['fps']
        aspect = source_width / source_height
        
        # Check 16:9 coordinate check (only on first 16:9 clip)
        if coordinate_check is None and abs(aspect - 16/9) < 0.01:
            ids = mapping[cls]['config_snapshot']['primary_joints']
            k = next((k for k, p in enumerate(landmarks) if min(p[ids, 3]) >= 0.5), None)
            if k is not None:
                p = landmarks[k]
                a, b, c = p[ids, :2]
                v = (a - b) * np.array([aspect, 1])
                u = (c - b) * np.array([aspect, 1])
                raw = float(np.degrees(np.arccos(np.clip(np.dot(v, u) / (np.linalg.norm(v) * np.linalg.norm(u) + 1e-8), -1, 1))))
                
                cfg = build_angle_config(cls, mapping, labels)
                joint_name = cfg['primaryJoints'][0]
                side = 'right' if 'right' in joint_name else 'left'
                cfg['primaryJoints'] = [joint_name]
                cfg['sideMode'] = 'unilateral'
                measured_result = count_landmarks_from_harness(
                    p[np.newaxis, ...], [0], aspect, cfg, {'emaAlpha': 1}
                )
                measured = measured_result['smoothedAngles'][0]
                
                coordinate_check = {
                    'id': vid,
                    'raw': raw,
                    'harness': measured,
                    'difference': abs(raw - measured)
                }
                print(f"  16:9 coordinate check on {vid}: raw={raw:.2f}, harness={measured:.2f}, diff={abs(raw-measured):.2f}")
        
        # Run harness
        angle_config = build_angle_config(cls, mapping, labels)
        harness_result = count_landmarks_from_harness(
            landmarks, timestamps_ms, aspect, angle_config, {'calibration': True}
        )
        
        predicted_count = harness_result['count']
        mae = abs(predicted_count - gt_count)
        signed_error = predicted_count - gt_count
        
        # Detection rate
        detected_count = int(detection_mask.sum())
        total_frames = len(timestamps_ms)
        detection_rate = detected_count / total_frames
        
        results.append({
            'id': vid,
            'class': cls,
            'split': split,
            'gt': gt_count,
            'count': predicted_count,
            'mae': mae,
            'signed_error': signed_error,
            'detected': detected_count,
            'frames': total_frames,
            'cycle_bounds_json': cycle_bounds,
            'detection_rate': detection_rate,
            'duration_sec': total_frames / fps,
        })
        
        print(f"  {phase} {i+1}/{len(meta)} {vid} class={cls} split={split} count={predicted_count} gt={gt_count} mae={mae} det_rate={detection_rate:.2f}")
    
    # Compute summary per class and overall
    summary = {}
    for cls in ['ALL'] + sorted(mapping.keys()):
        r = results if cls == 'ALL' else [x for x in results if x['class'] == cls]
        if not r:
            continue
        mae_arr = np.array([x['mae'] for x in r])
        se_arr = np.array([x['signed_error'] for x in r])
        gt_arr = np.array([x['gt'] for x in r])
        within1 = int((mae_arr <= 1).sum())
        exact = int((mae_arr == 0).sum())
        n = len(r)
        summary[cls] = {
            'n': n,
            'mae': float(mae_arr.mean()),
            'normalized_mae': float(mae_arr.mean() / gt_arr.mean()) if gt_arr.mean() > 0 else 0.0,
            'exact_pct': float(exact / n * 100),
            'within1_pct': float(within1 / n * 100),
            'within1_count': within1,
            'within1_wilson_ci': wilson_ci(within1, n),
            'mean_signed_error': float(se_arr.mean()),
            'detection_pct': 100.0 * sum(x['detected'] for x in r) / sum(x['frames'] for x in r) if sum(x['frames'] for x in r) > 0 else 0.0,
        }
    
    return {
        'results': results,
        'summary': summary,
        'exclusions': dict(exclusions),
        'coordinate_check': coordinate_check,
    }

def analyze_peaks_vs_reps(landmarks, timestamps_ms, aspect, angle_config, gt_count, harness_result, class_name):
    """
    Analyze peaks in smoothed angle signal vs counted reps.
    Returns list of missed peaks with reasons.
    """
    smoothed_angles = harness_result.get('smoothedAngles', [])
    peaks = harness_result.get('peaks', [])
    counted = harness_result.get('count', 0)
    
    # If harness doesn't return peaks, we need to compute them
    # For now, use the peaks from harness result
    detected_peaks = len(peaks)
    missed = gt_count - counted if gt_count > counted else 0
    
    reasons = []
    if missed > 0:
        # Check config thresholds
        cfg = angle_config
        full_range_thresh = cfg.get('fullRangeThreshold', 0.85)
        start_tol = cfg.get('startTolerance', 0.2)
        min_duration = cfg.get('minRepDurationMs', 400)
        max_duration = cfg.get('maxRepDurationMs', 10000)
        
        # Check ROM floor
        for joint in cfg['primaryJoints']:
            ref_range = cfg['referenceRanges'].get(joint, 0)
            if ref_range < 30:
                reasons.append('rom_below_floor_30deg')
                break
        
        # Check visibility
        # This would need landmark data - simplified for now
        reasons.append('threshold_or_visibility')
    
    return {
        'gt_count': gt_count,
        'counted': counted,
        'detected_peaks': detected_peaks,
        'missed_peaks': missed,
        'reasons': reasons,
    }

def run_dev_failure_analysis(mapping, labels):
    """Run detailed failure analysis on DEV (VALIDATION) split."""
    meta = load_manifest_with_splits('validation')
    
    if not meta:
        print("ERROR: Could not load validation manifest")
        return None
    
    print(f"DEV (VALIDATION) split: {len(meta)} videos in manifest")
    
    # Filter to only validation split videos (stu* and val*)
    # Exclude any train* or test* videos to avoid contamination
    dev_meta = [row for row in meta if row.get('split') in ['val', 'validation'] or row['video_id'].startswith('stu')]
    print(f"  After excluding train/test contamination: {len(dev_meta)} videos")
    
    class_results = defaultdict(list)
    worst_per_class = defaultdict(list)
    peak_analysis_per_class = defaultdict(list)
    
    for i, row in enumerate(dev_meta):
        action_type = row['action_type']
        cls = labels.get(action_type, 'excluded')
        if cls == 'excluded':
            continue
        
        vid = row['video_id']
        gt_count = int(row['count'])
        
        # Find cache file
        cache_file = CACHE / f'validation_{vid}.npz'
        if not cache_file.exists():
            for prefix in ['test', 'validation']:
                alt = CACHE / f'{prefix}_{vid}.npz'
                if alt.exists():
                    cache_file = alt
                    break
        
        if not cache_file:
            print(f"  WARNING: No cache for {vid}, skipping")
            continue
        
        angle_config = build_angle_config(cls, mapping, labels)
        
        try:
            data = np.load(cache_file, allow_pickle=True)
            landmarks = data['landmarks']
            timestamps_ms = data['timestamps_ms']
            aspect = data['source_width'] / data['source_height']
            
            harness_result = count_landmarks_from_harness(
                landmarks, timestamps_ms, aspect, angle_config, {'calibration': True}
            )
            
            # Peak analysis
            peak_info = analyze_peaks_vs_reps(
                landmarks, timestamps_ms, aspect, angle_config, gt_count, harness_result, cls
            )
            peak_analysis_per_class[cls].append({
                'video_id': vid,
                **peak_info
            })
            
            # Standard analysis
            predicted_count = harness_result['count']
            mae = abs(predicted_count - gt_count)
            signed_error = predicted_count - gt_count
            is_undercount = predicted_count < gt_count
            is_overcount = predicted_count > gt_count
            
            detection_mask = data['detection_mask']
            total_frames = len(timestamps_ms)
            detection_rate = int(detection_mask.sum()) / total_frames
            duration_sec = total_frames / data['fps']
            
            # Config info
            cfg = mapping[cls]['config_snapshot']
            primary_center = cfg['primary_joints'][1]
            primary_joint_name = JOINT_NAMES[primary_center]
            side_mode = cfg['side_mode']
            
            # Compute ROM
            if primary_joint_name in CANDIDATE_JOINTS:
                left_triplet = CANDIDATE_JOINTS[primary_joint_name]['left']
                right_triplet = CANDIDATE_JOINTS[primary_joint_name]['right']
                left_angles = compute_joint_angle(landmarks, *left_triplet)
                right_angles = compute_joint_angle(landmarks, *right_triplet)
                left_rom = compute_rom(left_angles)
                right_rom = compute_rom(right_angles)
                primary_rom = max(left_rom, right_rom)
                rom_above_floor = primary_rom >= 30.0
            else:
                left_rom = right_rom = primary_rom = 0.0
                rom_above_floor = False
            
            # Rejection reasons
            rejection_reasons = []
            if not rom_above_floor:
                rejection_reasons.append('rom_below_floor')
            if duration_sec < 0.4:
                rejection_reasons.append('duration_too_short')
            elif duration_sec > 10.0:
                rejection_reasons.append('duration_too_long')
            if detection_rate < 0.5:
                rejection_reasons.append('visibility_loss')
            
            # Visibility
            primary_vis = landmarks[:, primary_center, 3]
            mean_visibility = float(np.mean(primary_vis))
            
            left_idx = primary_center - 1 if primary_center in [12, 14, 24, 26, 28] else primary_center
            right_idx = primary_center + 1 if primary_center in [11, 13, 23, 25, 27] else primary_center
            if primary_center in [11, 13, 23, 25, 27]:
                left_idx = primary_center
                right_idx = primary_center + 1
            elif primary_center in [12, 14, 24, 26, 28]:
                left_idx = primary_center - 1
                right_idx = primary_center
            
            left_vis = float(np.mean(landmarks[:, left_idx, 3]))
            right_vis = float(np.mean(landmarks[:, right_idx, 3]))
            side_view_ratio = min(left_vis, right_vis) / max(left_vis, right_vis) if max(left_vis, right_vis) > 0 else 0.0
            
            analysis = {
                'video_id': vid,
                'class': cls,
                'gt_count': gt_count,
                'predicted_count': predicted_count,
                'mae': mae,
                'signed_error': signed_error,
                'is_undercount': is_undercount,
                'is_overcount': is_overcount,
                'detection_rate': detection_rate,
                'duration_sec': duration_sec,
                'total_frames': total_frames,
                'rejection_reasons': rejection_reasons,
                'primary_joint': primary_joint_name,
                'primary_rom': primary_rom,
                'rom_above_floor': rom_above_floor,
                'left_rom': left_rom,
                'right_rom': right_rom,
                'mean_visibility': mean_visibility,
                'left_visibility': left_vis,
                'right_visibility': right_vis,
                'side_view_ratio': side_view_ratio,
                'side_mode': side_mode,
                'config_start': cfg['start_angle'],
                'config_peak': cfg['peak_angle'],
                'config_rom': abs(cfg['peak_angle'] - cfg['start_angle']),
                'config_direction': cfg['direction'],
                'cache_path': str(cache_file),
            }
            
            class_results[cls].append(analysis)
            worst_per_class[cls].append(analysis)
            worst_per_class[cls].sort(key=lambda x: -x['mae'])
            if len(worst_per_class[cls]) > 3:
                worst_per_class[cls] = worst_per_class[cls][:3]
                
        except Exception as e:
            print(f"  ERROR processing {vid}: {e}")
            continue
        
        if (i + 1) % 20 == 0:
            print(f"  Processed {i+1}/{len(dev_meta)} dev videos...")
    
    # Generate detailed report
    report = {}
    for cls, results in sorted(class_results.items()):
        if not results:
            continue
        
        n = len(results)
        maes = [r['mae'] for r in results]
        signed_errors = [r['signed_error'] for r in results]
        undercounts = sum(1 for r in results if r['is_undercount'])
        overcounts = sum(1 for r in results if r['is_overcount'])
        
        rejection_counts = Counter()
        for r in results:
            for reason in r['rejection_reasons']:
                rejection_counts[reason] += 1
        
        mean_vis = np.mean([r['mean_visibility'] for r in results])
        mean_side_ratio = np.mean([r['side_view_ratio'] for r in results])
        
        roms = [r['primary_rom'] for r in results]
        rom_above_floor = sum(1 for r in results if r['rom_above_floor'])
        
        joint_triplet = f"{results[0]['primary_joint']} ({results[0]['left_rom']:.1f}/{results[0]['right_rom']:.1f})"
        config_rom = results[0]['config_rom']
        config_direction = results[0]['config_direction']
        side_mode = results[0]['side_mode']
        
        # Worst 3 clips with angle curves
        worst_details = []
        for w in worst_per_class[cls]:
            data = np.load(w['cache_path'], allow_pickle=True)
            landmarks = data['landmarks']
            cycle_bounds = []
            try:
                cycle_bounds = json.loads(w['cycle_bounds_json']) if w.get('cycle_bounds_json') else []
            except:
                cycle_bounds = []
            
            primary_center = mapping[cls]['config_snapshot']['primary_joints'][1]
            primary_joint_name = JOINT_NAMES[primary_center]
            if primary_joint_name in CANDIDATE_JOINTS:
                left_triplet = CANDIDATE_JOINTS[primary_joint_name]['left']
                right_triplet = CANDIDATE_JOINTS[primary_joint_name]['right']
                left_angles = compute_joint_angle(landmarks, *left_triplet)
                right_angles = compute_joint_angle(landmarks, *right_triplet)
                angle_curves = {
                    'left': left_angles.tolist(),
                    'right': right_angles.tolist(),
                    'timestamps_ms': data['timestamps_ms'],
                    'cycle_bounds': cycle_bounds,
                }
            else:
                angle_curves = None
            
            worst_details.append({
                'video_id': w['video_id'],
                'gt': w['gt_count'],
                'predicted': w['predicted_count'],
                'mae': w['mae'],
                'signed_error': w['signed_error'],
                'rejection_reasons': w['rejection_reasons'],
                'duration_sec': w['duration_sec'],
                'detection_rate': w['detection_rate'],
                'angle_curves': angle_curves,
            })
        
        report[cls] = {
            'videos_analyzed': n,
            'mae_mean': float(np.mean(maes)),
            'mae_std': float(np.std(maes)),
            'mae_range': [float(np.min(maes)), float(np.max(maes))],
            'mean_signed_error': float(np.mean(signed_errors)),
            'undercounts': undercounts,
            'overcounts': overcounts,
            'rejection_reasons': dict(rejection_counts),
            'mean_visibility': float(mean_vis),
            'mean_side_view_ratio': float(mean_side_ratio),
            'primary_rom_mean': float(np.mean(roms)),
            'rom_above_floor_count': rom_above_floor,
            'rom_above_floor_pct': rom_above_floor / n * 100,
            'joint_triplet': joint_triplet,
            'config_rom': config_rom,
            'config_direction': config_direction,
            'side_mode': side_mode,
            'worst_3_clips': worst_details,
            'peak_analysis': peak_analysis_per_class.get(cls, []),
        }
    
    return report

def run_parameter_sweep(mapping, labels):
    """Sweep parameters on DEV set to reduce undercount."""
    print("\n" + "="*60)
    print("=== PARAMETER SWEEP ON DEV ===")
    print("="*60)
    
    meta = load_manifest_with_splits('validation')
    dev_meta = [row for row in meta if row.get('split') in ['val', 'validation'] or row['video_id'].startswith('stu')]
    
    # Limit to 30 videos per class
    class_counts = defaultdict(int)
    sweep_meta = []
    for row in dev_meta:
        action_type = row['action_type']
        cls = labels.get(action_type, 'excluded')
        if cls == 'excluded':
            continue
        if class_counts[cls] < 30:
            sweep_meta.append(row)
            class_counts[cls] += 1
    
    print(f"Sweep videos: {len(sweep_meta)} total")
    for cls, cnt in sorted(class_counts.items()):
        print(f"  {cls}: {cnt}")
    
    # Parameter grid
    param_grid = {
        'emaAlpha': [0.1, 0.2, 0.3, 0.4, 0.5, 0.6],
        'fullRangeThreshold': [0.60, 0.65, 0.70, 0.75, 0.80, 0.85],
        'startTolerance': [0.15, 0.20, 0.25, 0.30],
        'minRepDurationMs': [300, 400, 500, 600],
        'maxRepDurationMs': [8000, 10000, 12000],
        'extractionFPS': [15, 30],
    }
    
    # Baseline config
    baseline = {'calibration': True, 'emaAlpha': 0.3, 'fullRangeThreshold': 0.85, 'startTolerance': 0.2, 'minRepDurationMs': 400, 'maxRepDurationMs': 10000}
    
    sweep_results = {}
    
    for param_name, values in param_grid.items():
        print(f"\nSweeping {param_name}...")
        sweep_results[param_name] = {}
        
        for value in values:
            # Build counter config
            if param_name == 'extractionFPS':
                # This requires re-extraction, skip for now
                continue
            
            counter_config = baseline.copy()
            counter_config[param_name] = value
            
            # Evaluate on sweep set
            class_mae = defaultdict(list)
            class_undercount = defaultdict(int)
            class_overcount = defaultdict(int)
            
            for row in sweep_meta:
                action_type = row['action_type']
                cls = labels.get(action_type, 'excluded')
                if cls == 'excluded':
                    continue
                
                vid = row['video_id']
                gt_count = int(row['count'])
                
                cache_file = CACHE / f'validation_{vid}.npz'
                if not cache_file.exists():
                    continue
                
                try:
                    data = np.load(cache_file, allow_pickle=True)
                    landmarks = data['landmarks']
                    timestamps_ms = data['timestamps_ms']
                    aspect = data['source_width'] / data['source_height']
                    
                    angle_config = build_angle_config(cls, mapping, labels)
                    harness_result = count_landmarks_from_harness(
                        landmarks, timestamps_ms, aspect, angle_config, counter_config
                    )
                    
                    predicted = harness_result['count']
                    mae = abs(predicted - gt_count)
                    class_mae[cls].append(mae)
                    if predicted < gt_count:
                        class_undercount[cls] += 1
                    elif predicted > gt_count:
                        class_overcount[cls] += 1
                except Exception:
                    pass
            
            # Aggregate
            overall_mae = np.mean([m for ms in class_mae.values() for m in ms]) if class_mae else 0
            overall_under = sum(class_undercount.values())
            overall_over = sum(class_overcount.values())
            
            sweep_results[param_name][value] = {
                'overall_mae': float(overall_mae),
                'undercounts': overall_under,
                'overcounts': overall_over,
                'per_class_mae': {cls: float(np.mean(ms)) for cls, ms in class_mae.items()},
            }
            
            print(f"  {param_name}={value}: MAE={overall_mae:.2f}, under={overall_under}, over={overall_over}")
    
    return sweep_results

def run_signal_selection(mapping, labels):
    """Supervised signal selection per class on DEV."""
    print("\n" + "="*60)
    print("=== SUPERVISED SIGNAL SELECTION ON DEV ===")
    print("="*60)
    
    meta = load_manifest_with_splits('validation')
    dev_meta = [row for row in meta if row.get('split') in ['val', 'validation'] or row['video_id'].startswith('stu')]
    
    # Limit to 30 videos per class
    class_counts = defaultdict(int)
    dev_meta_limited = []
    for row in dev_meta:
        action_type = row['action_type']
        cls = labels.get(action_type, 'excluded')
        if cls == 'excluded':
            continue
        if class_counts[cls] < 30:
            dev_meta_limited.append(row)
            class_counts[cls] += 1
    
    signal_results = {}
    
    for cls in ['jumping_jack', 'push_up', 'bench_press', 'situp', 'squat', 'front_raise', 'pull_up']:
        if cls not in PLAUSIBLE_SIGNALS:
            continue
        
        print(f"\nClass: {cls}")
        candidates = PLAUSIBLE_SIGNALS[cls]
        
        # For each candidate, evaluate on dev videos
        candidate_scores = {}
        
        for joint_name, signal_type, triplet_desc in candidates:
            # Skip hip for bench_press
            if cls == 'bench_press' and joint_name == 'hip':
                print(f"  Skipping hip for bench_press (not allowed)")
                continue
            
            # Build angle config for this joint
            if joint_name not in CANDIDATE_JOINTS:
                continue
            
            # We'll use bilateral with visibility-weighted fusion
            # For now, just test both sides and pick best
            maes = []
            visibilities = []
            
            for row in dev_meta_limited:
                if labels.get(row['action_type']) != cls:
                    continue
                vid = row['video_id']
                gt_count = int(row['count'])
                
                cache_file = CACHE / f'validation_{vid}.npz'
                if not cache_file.exists():
                    continue
                
                try:
                    data = np.load(cache_file, allow_pickle=True)
                    landmarks = data['landmarks']
                    timestamps_ms = data['timestamps_ms']
                    aspect = data['source_width'] / data['source_height']
                    
                    # Test left and right
                    for side in ['left', 'right']:
                        triplet = CANDIDATE_JOINTS[joint_name][side]
                        angles = compute_joint_angle(landmarks, *triplet)
                        rom = compute_rom(angles)
                        
                        # Visibility of center joint
                        center_idx = triplet[0]
                        vis = float(np.mean(landmarks[:, center_idx, 3]))
                        
                        if vis < 0.5:
                            continue  # Skip low visibility
                        
                        # Build config for this single joint
                        cfg = mapping[cls]['config_snapshot']
                        angle_config = {
                            'primaryJoints': [f'{side}_{joint_name}'],
                            'sideMode': 'unilateral',
                            'startAngles': {f'{side}_{joint_name}': cfg['start_angle']},
                            'peakAngles': {f'{side}_{joint_name}': cfg['peak_angle']},
                            'directions': {f'{side}_{joint_name}': 'decreasing' if cfg['peak_angle'] < cfg['start_angle'] else 'increasing'},
                            'referenceRanges': {f'{side}_{joint_name}': abs(cfg['peak_angle'] - cfg['start_angle'])},
                            'stabilityConstraints': [],
                            'viewHint': 'unknown'
                        }
                        
                        harness_result = count_landmarks_from_harness(
                            landmarks, timestamps_ms, aspect, angle_config, {'calibration': True}
                        )
                        
                        predicted = harness_result['count']
                        mae = abs(predicted - gt_count)
                        maes.append(mae)
                        visibilities.append(vis)
                        
                except Exception as e:
                    pass
            
            if maes:
                candidate_scores[(joint_name, signal_type)] = {
                    'mean_mae': float(np.mean(maes)),
                    'mean_visibility': float(np.mean(visibilities)),
                    'n': len(maes),
                    'exact_pct': float(sum(1 for m in maes if m == 0) / len(maes) * 100),
                    'within1_pct': float(sum(1 for m in maes if m <= 1) / len(maes) * 100),
                }
                print(f"  {joint_name} ({signal_type}): MAE={candidate_scores[(joint_name, signal_type)]['mean_mae']:.2f}, vis={candidate_scores[(joint_name, signal_type)]['mean_visibility']:.2f}, n={candidate_scores[(joint_name, signal_type)]['n']}")
        
        # Pick best candidate
        if candidate_scores:
            best_key = min(candidate_scores.items(), key=lambda x: x[1]['mean_mae'])
            signal_results[cls] = {
                'best_joint': best_key[0][0],
                'best_signal': best_key[0][1],
                'best_score': best_key[1],
                'all_candidates': {f"{k[0]}_{k[1]}": v for k, v in candidate_scores.items()},
            }
            print(f"  >> BEST: {best_key[0][0]} ({best_key[0][1]}) MAE={best_key[1]['mean_mae']:.2f}")
        else:
            signal_results[cls] = {'error': 'No valid candidates'}
            print(f"  >> NO VALID CANDIDATES")
    
    return signal_results

def main():
    parser = argparse.ArgumentParser(description='PhysiqueQuest RepCount Evaluation')
    parser.add_argument('--mode', choices=['all', 'validation', 'test', 'train', 'sweep', 'signals'], default='all',
                       help='Evaluation mode')
    args = parser.parse_args()
    
    OUT.mkdir(parents=True, exist_ok=True)
    RAW.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    
    mapping, labels = load_configs()
    
    # Frozen settings hash
    freeze = {
        'thresholds': 'GenericRepCounter defaults, calibration=true',
        'tuning': 'none; DEV inspected without parameter changes',
        'map_sha256': hashlib.sha256((ML / 'configs' / 'repcount_class_map.json').read_bytes()).hexdigest(),
        'counter_sha256': hashlib.sha256((ML.parent / 'shared' / 'genericRepCounter.ts').read_bytes()).hexdigest() if (ML.parent / 'shared' / 'genericRepCounter.ts').exists() else 'unknown',
    }
    
    all_results = {}
    
    if args.mode in ['all', 'validation']:
        print("\n" + "="*60)
        print("=== VALIDATION PHASE ===")
        print("="*60)
        val_result = run_validation_test_phase('validation', mapping, labels, freeze)
        if val_result:
            all_results['validation'] = val_result
            (OUT / 'validation_results.json').write_text(json.dumps(json_safe(val_result['results']), indent=2))
            (OUT / 'validation_summary.json').write_text(json.dumps(json_safe(val_result['summary']), indent=2))
            (OUT / 'validation_exclusions.json').write_text(json.dumps(json_safe(val_result['exclusions']), indent=2))
            print(f"\nValidation Summary:")
            for cls, stats in sorted(val_result['summary'].items()):
                if cls != 'ALL':
                    ci = stats.get('within1_wilson_ci', (0,0))
                    print(f"  {cls}: n={stats['n']}, MAE={stats['mae']:.2f}, nMAE={stats['normalized_mae']:.3f}, exact={stats['exact_pct']:.1f}%, within1={stats['within1_pct']:.1f}% (CI={ci[0]:.1%}-{ci[1]:.1%}), MSE={stats['mean_signed_error']:.2f}, det={stats['detection_pct']:.1f}%")
            overall = val_result['summary']['ALL']
            print(f"  OVERALL: n={overall['n']}, MAE={overall['mae']:.2f}, exact={overall['exact_pct']:.1f}%, within1={overall['within1_pct']:.1f}%, MSE={overall['mean_signed_error']:.2f}")
            print(f"  Excluded: {val_result['exclusions']}")
            if val_result['coordinate_check']:
                print(f"  16:9 harness-vs-raw: {val_result['coordinate_check']}")
    
    if args.mode in ['all', 'test']:
        print("\n" + "="*60)
        print("=== TEST PHASE (FROZEN SETTINGS - SECOND LOOK) ===")
        print("="*60)
        (OUT / 'frozen_settings.json').write_text(json.dumps(freeze, indent=2))
        test_result = run_validation_test_phase('test', mapping, labels, freeze)
        if test_result:
            all_results['test'] = test_result
            (OUT / 'test_results.json').write_text(json.dumps(json_safe(test_result['results']), indent=2))
            (OUT / 'test_summary.json').write_text(json.dumps(json_safe(test_result['summary']), indent=2))
            (OUT / 'test_exclusions.json').write_text(json.dumps(json_safe(test_result['exclusions']), indent=2))
            print(f"\nTest Summary (SECOND LOOK - already seen once):")
            for cls, stats in sorted(test_result['summary'].items()):
                if cls != 'ALL':
                    ci = stats.get('within1_wilson_ci', (0,0))
                    print(f"  {cls}: n={stats['n']}, MAE={stats['mae']:.2f}, nMAE={stats['normalized_mae']:.3f}, exact={stats['exact_pct']:.1f}%, within1={stats['within1_pct']:.1f}% (CI={ci[0]:.1%}-{ci[1]:.1%}), MSE={stats['mean_signed_error']:.2f}, det={stats['detection_pct']:.1f}%")
            overall = test_result['summary']['ALL']
            print(f"  OVERALL: n={overall['n']}, MAE={overall['mae']:.2f}, exact={overall['exact_pct']:.1f}%, within1={overall['within1_pct']:.1f}%, MSE={overall['mean_signed_error']:.2f}")
            print(f"  Excluded: {test_result['exclusions']}")
            if test_result['coordinate_check']:
                print(f"  16:9 harness-vs-raw: {test_result['coordinate_check']}")
    
    if args.mode in ['all', 'train']:
        print("\n" + "="*60)
        print("=== DEV (VALIDATION) FAILURE ANALYSIS ===")
        print("="*60)
        print("NOTE: Train split (758 videos) not accessible - using VALIDATION as dev set")
        dev_report = run_dev_failure_analysis(mapping, labels)
        all_results['dev'] = dev_report
        (OUT / 'dev_failure_analysis.json').write_text(json.dumps(json_safe(dev_report), indent=2))
        print("\nDev Failure Analysis Summary:")
        for cls, stats in sorted(dev_report.items()):
            print(f"\n  {cls}:")
            print(f"    Videos analyzed: {stats['videos_analyzed']}")
            print(f"    MAE: {stats['mae_mean']:.2f} ± {stats['mae_std']:.2f} (range {stats['mae_range'][0]:.1f}-{stats['mae_range'][1]:.1f})")
            print(f"    Mean signed error: {stats['mean_signed_error']:.2f}")
            print(f"    Undercounts: {stats['undercounts']}, Overcounts: {stats['overcounts']}")
            print(f"    Rejection reasons: {stats['rejection_reasons']}")
            print(f"    Mean visibility: {stats['mean_visibility']:.3f}, Side view ratio: {stats['mean_side_view_ratio']:.3f}")
            print(f"    Primary ROM: {stats['primary_rom_mean']:.1f}° (config: {stats['config_rom']:.1f}°), Above 30° floor: {stats['rom_above_floor_pct']:.1f}%")
            print(f"    Joint triplet: {stats['joint_triplet']}, Side mode: {stats['side_mode']}, Direction: {stats['config_direction']}")
            print(f"    Worst 3 clips:")
            for w in stats['worst_3_clips']:
                print(f"      {w['video_id']}: gt={w['gt']}, pred={w['predicted']}, mae={w['mae']}, reasons={w['rejection_reasons']}")
    
    if args.mode in ['all', 'sweep']:
        sweep_results = run_parameter_sweep(mapping, labels)
        all_results['sweep'] = sweep_results
        (OUT / 'parameter_sweep.json').write_text(json.dumps(json_safe(sweep_results), indent=2))
    
    if args.mode in ['all', 'signals']:
        signal_results = run_signal_selection(mapping, labels)
        all_results['signals'] = signal_results
        (OUT / 'signal_selection.json').write_text(json.dumps(json_safe(signal_results), indent=2))
    
    # Generate FINAL_REPORT.json if we have both val and test
    if 'validation' in all_results and 'test' in all_results:
        classes = ['squat', 'push_up', 'bench_press', 'front_raise', 'pull_up', 'situp', 'jumping_jack']
        per_class = {}
        for cls in classes:
            val_info = all_results['validation']['summary'].get(cls)
            test_info = all_results['test']['summary'].get(cls)
            test_reliable = test_info and test_info['within1_pct'] >= 70.0
            val_reliable = val_info and val_info['within1_pct'] >= 70.0
            
            # Pooled stats
            val_n = val_info['n'] if val_info else 0
            test_n = test_info['n'] if test_info else 0
            val_within1 = val_info['within1_count'] if val_info else 0
            test_within1 = test_info['within1_count'] if test_info else 0
            pooled_n = val_n + test_n
            pooled_within1 = val_within1 + test_within1
            pooled_within1_pct = (pooled_within1 / pooled_n * 100) if pooled_n > 0 else 0
            pooled_ci = wilson_ci(pooled_within1, pooled_n) if pooled_n > 0 else (0, 0)
            
            per_class[cls] = {
                'validation': val_info,
                'test': test_info,
                'reliable_on_test': test_reliable,
                'reliable_on_val': val_reliable,
                'pooled': {
                    'n': pooled_n,
                    'within1_count': pooled_within1,
                    'within1_pct': pooled_within1_pct,
                    'within1_wilson_ci': pooled_ci,
                },
                'eligible_verified': pooled_n >= 25 and pooled_within1_pct >= 70.0,
            }
        
        final_report = {
            'frozen_settings': freeze,
            'summary': {
                'validation_total_videos': all_results['validation']['summary']['ALL']['n'],
                'test_total_videos': all_results['test']['summary']['ALL']['n'],
                'test_excluded_videos': sum(all_results['test']['exclusions'].values()),
                'overall_validation_mae': all_results['validation']['summary']['ALL']['mae'],
                'overall_validation_exact_pct': all_results['validation']['summary']['ALL']['exact_pct'],
                'overall_validation_within1_pct': all_results['validation']['summary']['ALL']['within1_pct'],
                'overall_test_mae': all_results['test']['summary']['ALL']['mae'],
                'overall_test_exact_pct': all_results['test']['summary']['ALL']['exact_pct'],
                'overall_test_within1_pct': all_results['test']['summary']['ALL']['within1_pct'],
            },
            'per_class': per_class,
            'reliability_assessment': {
                'reliable_classes': [cls for cls in classes if per_class[cls]['reliable_on_test']],
                'unreliable_classes': [cls for cls in classes if not per_class[cls]['reliable_on_test']],
                'threshold': 'within ±1 on >= 70% of videos',
                'eligible_verified': [cls for cls in classes if per_class[cls]['eligible_verified']],
            },
            'notes': 'Test run once with frozen settings. No tuning on test set. Test results are a "second look" because test split was seen once. Train split (758 videos) not accessible from HF - using VALIDATION as dev set.',
        }
        (OUT / 'FINAL_REPORT.json').write_text(json.dumps(json_safe(final_report), indent=2))
        print(f"\nFINAL_REPORT.json written")
    
    print("\n" + "="*60)
    print("EVALUATION COMPLETE")
    print("="*60)

if __name__ == '__main__':
    main()