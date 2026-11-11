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
    # Use the existing Python bridge which uses Node.js
    try:
        return count_landmarks(landmarks, timestamps_ms, aspect, angle_config, counter_config)
    except Exception:
        # Fallback: direct Node.js call
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

def analyze_video_failure(cache_path, angle_config, gt_count, harness_result, class_name, mapping, labels):
    """Analyze a single video for failure modes."""
    data = np.load(cache_path, allow_pickle=True)
    landmarks = data['landmarks']
    timestamps_ms = data['timestamps_ms']
    detection_mask = data['detection_mask']
    width = data['width']
    height = data['height']
    source_width = data['source_width']
    source_height = data['source_height']
    fps = data['fps']
    
    aspect = source_width / source_height
    total_frames = len(timestamps_ms)
    detected_count = int(detection_mask.sum())
    detection_rate = detected_count / total_frames
    duration_sec = total_frames / fps
    
    predicted_count = harness_result['count']
    mae = abs(predicted_count - gt_count)
    signed_error = predicted_count - gt_count  # positive = overcount, negative = undercount
    is_undercount = predicted_count < gt_count
    is_overcount = predicted_count > gt_count
    
    # Get primary joint from config
    cfg = mapping[class_name]['config_snapshot']
    primary_center = cfg['primary_joints'][1]  # center joint index
    primary_joint_name = JOINT_NAMES[primary_center]
    side_mode = cfg['side_mode']
    
    # Compute ROM of primary joint (both sides)
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
    
    # Stability: check if angle changes smoothly (simplified)
    # Check visibility loss
    if detection_rate < 0.5:
        rejection_reasons.append('visibility_loss')
    
    # Landmark visibility of primary joint
    primary_vis = landmarks[:, primary_center, 3]
    mean_visibility = float(np.mean(primary_vis))
    
    # Side view ratio (left vs right visibility)
    left_idx = primary_center - 1 if primary_center in [12, 14, 24, 26, 28] else primary_center
    right_idx = primary_center + 1 if primary_center in [11, 13, 23, 25, 27] else primary_center
    if primary_center in [11, 13, 23, 25, 27]:  # left side
        left_idx = primary_center
        right_idx = primary_center + 1
    elif primary_center in [12, 14, 24, 26, 28]:  # right side
        left_idx = primary_center - 1
        right_idx = primary_center
    
    left_vis = float(np.mean(landmarks[:, left_idx, 3]))
    right_vis = float(np.mean(landmarks[:, right_idx, 3]))
    side_view_ratio = min(left_vis, right_vis) / max(left_vis, right_vis) if max(left_vis, right_vis) > 0 else 0.0
    
    # Best candidate joint analysis (for jumping_jack, situp, bench_press, push_up)
    best_candidate = None
    if class_name in ['jumping_jack', 'situp', 'bench_press', 'push_up']:
        best_rom = 0
        best_joint = None
        best_side = None
        for joint_name, triplets in CANDIDATE_JOINTS.items():
            for side, triplet in triplets.items():
                if max(triplet) >= 33:  # skip invalid indices (ankle->foot)
                    continue
                try:
                    angles = compute_joint_angle(landmarks, *triplet)
                    rom = compute_rom(angles)
                    if rom > best_rom:
                        best_rom = rom
                        best_joint = joint_name
                        best_side = side
                except:
                    pass
        best_candidate = {
            'joint': best_joint,
            'side': best_side,
            'rom': best_rom,
            'config_joint': primary_joint_name,
            'config_rom': primary_rom
        }
    
    return {
        'video_id': cache_path.stem.replace('validation_', '').replace('test_', '').replace('train_', ''),
        'class': class_name,
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
        'best_candidate': best_candidate,
        'side_mode': side_mode,
        'config_start': cfg['start_angle'],
        'config_peak': cfg['peak_angle'],
        'config_rom': abs(cfg['peak_angle'] - cfg['start_angle']),
        'config_direction': cfg['direction'],
        'cache_path': str(cache_path),
    }

def run_validation_test_phase(phase, mapping, labels, frozen_settings=None):
    """Run evaluation for validation or test phase using cached keypoints."""
    manifest_path = OUT / f'{phase}_manifest.csv'
    
    if not manifest_path.exists():
        # Try to load from HF lance dataset (as evaluate_repcount.py does)
        try:
            import lance
            ds = lance.dataset(f'hf://datasets/lmms-lab-eval/repcounta-lance/data/{phase}.lance')
            meta = ds.to_table(columns=['video_id', 'source_name', 'action_type', 'count', 'cycle_bounds_json', 'video_ext']).to_pylist()
            # Write manifest
            with open(manifest_path, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=list(meta[0].keys()))
                writer.writeheader()
                writer.writerows(meta)
        except Exception as e:
            print(f"ERROR: Could not load {phase} manifest: {e}")
            return None
    
    # Load manifest
    with open(manifest_path, newline='') as f:
        reader = csv.DictReader(f)
        meta = list(reader)
    
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
        
        # Find cache file (priority: test_ prefix, then validation_)
        cache_file = CACHE / f'{phase}_{vid}.npz'
        if not cache_file.exists():
            # Try alternate prefixes
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
            # Get primary joint indices for this class
            ids = mapping[cls]['config_snapshot']['primary_joints']
            k = next((k for k, p in enumerate(landmarks) if min(p[ids, 3]) >= 0.5), None)
            if k is not None:
                p = landmarks[k]
                a, b, c = p[ids, :2]
                v = (a - b) * np.array([aspect, 1])
                u = (c - b) * np.array([aspect, 1])
                raw = float(np.degrees(np.arccos(np.clip(np.dot(v, u) / (np.linalg.norm(v) * np.linalg.norm(u) + 1e-8), -1, 1))))
                
                # Compute harness angle for same frame
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
        
        print(f"  {phase} {i+1}/{len(meta)} {vid} class={cls} count={predicted_count} gt={gt_count} mae={mae} det_rate={detection_rate:.2f}")
    
    # Compute summary
    summary = {}
    for cls in ['ALL'] + sorted(mapping.keys()):
        r = results if cls == 'ALL' else [x for x in results if x['class'] == cls]
        if not r:
            continue
        mae_arr = np.array([x['mae'] for x in r])
        se_arr = np.array([x['signed_error'] for x in r])
        summary[cls] = {
            'n': len(r),
            'mae': float(mae_arr.mean()),
            'normalized_mae': float(mae_arr.mean() / np.array([x['gt'] for x in r]).mean()) if np.array([x['gt'] for x in r]).mean() > 0 else 0.0,
            'exact_pct': float((mae_arr == 0).mean() * 100),
            'within1_pct': float((mae_arr <= 1).mean() * 100),
            'mean_signed_error': float(se_arr.mean()),
            'detection_pct': 100.0 * sum(x['detected'] for x in r) / sum(x['frames'] for x in r) if sum(x['frames'] for x in r) > 0 else 0.0,
        }
    
    return {
        'results': results,
        'summary': summary,
        'exclusions': dict(exclusions),
        'coordinate_check': coordinate_check,
    }

def run_train_failure_analysis(mapping, labels):
    """Run detailed failure analysis on TRAIN split (758 videos)."""
    # Try to load train manifest from HF
    try:
        import lance
        ds = lance.dataset('hf://datasets/lmms-lab-eval/repcounta-lance/data/train.lance')
        meta = ds.to_table(columns=['video_id', 'source_name', 'action_type', 'count', 'cycle_bounds_json', 'video_ext']).to_pylist()
        print(f"Loaded TRAIN split: {len(meta)} videos from HF dataset")
    except Exception as e:
        print(f"ERROR: Could not load train dataset from HF: {e}")
        # Fallback: check if there's a local train manifest
        train_manifest = ML / 'data' / 'processed' / 'train_manifest.json'
        if train_manifest.exists():
            with open(train_manifest) as f:
                meta = json.load(f)
            print(f"Loaded TRAIN split: {len(meta)} videos from local manifest")
        else:
            # Try to infer from test_manifest.csv rows that have train* video_ids
            # (this is NOT the full train split, just what's in test manifest)
            with open(OUT / 'test_manifest.csv', newline='') as f:
                reader = csv.DictReader(f)
                meta = [row for row in reader if row['video_id'].startswith('train')]
            print(f"WARNING: Using {len(meta)} train-videos from test manifest (NOT full 758)")
    
    class_results = defaultdict(list)
    worst_per_class = defaultdict(list)
    
    for i, row in enumerate(meta):
        # Skip rows with None count
        if row.get('count') is None:
            print(f"  Skipping {row.get('video_id', 'unknown')} due to None count")
            continue
            
        action_type = row['action_type']
        cls = labels.get(action_type, 'excluded')
        if cls == 'excluded':
            continue
        
        vid = row['video_id']
        gt_count = int(row['count'])
        
        # Find cache file (try multiple prefixes)
        cache_file = None
        for prefix in ['train', 'test', 'validation']:
            candidate = CACHE / f'{prefix}_{vid}.npz'
            if candidate.exists():
                cache_file = candidate
                break
        
        if not cache_file:
            # Try to extract from raw video
            video_file = None
            for prefix in ['train', 'test', 'validation']:
                for ext in ['.mp4', '.MP4', '.mov', '.MOV']:
                    candidate = RAW / f'{prefix}_{vid}{ext}'
                    if candidate.exists():
                        video_file = candidate
                        break
                if video_file:
                    break
            
            if video_file:
                print(f"  Extracting keypoints for {vid}...")
                try:
                    cache_file = CACHE / f'train_{vid}.npz'
                    extract_keypoints(video_file, cache_file)
                except Exception as e:
                    print(f"  ERROR extracting {vid}: {e}")
                    continue
            else:
                print(f"  WARNING: No video or cache for {vid}, skipping")
                continue
        
        # Build angle config
        angle_config = build_angle_config(cls, mapping, labels)
        
        # Load cached data and run harness
        try:
            data = np.load(cache_file, allow_pickle=True)
            landmarks = data['landmarks']
            timestamps_ms = data['timestamps_ms']
            aspect = data['source_width'] / data['source_height']
            
            harness_result = count_landmarks_from_harness(
                landmarks, timestamps_ms, aspect, angle_config, {'calibration': True}
            )
            
            # Analyze failure
            analysis = analyze_video_failure(cache_file, angle_config, gt_count, harness_result, cls, mapping, labels)
            class_results[cls].append(analysis)
            
            # Track worst 3 per class (by MAE)
            worst_per_class[cls].append(analysis)
            worst_per_class[cls].sort(key=lambda x: -x['mae'])
            if len(worst_per_class[cls]) > 3:
                worst_per_class[cls] = worst_per_class[cls][:3]
            
        except Exception as e:
            print(f"  ERROR processing {vid}: {e}")
            continue
        
        if (i + 1) % 50 == 0:
            print(f"  Processed {i+1}/{len(meta)} train videos...")
    
    # Generate detailed failure analysis report
    report = {}
    for cls, results in sorted(class_results.items()):
        if not results:
            continue
        
        n = len(results)
        maes = [r['mae'] for r in results]
        signed_errors = [r['signed_error'] for r in results]
        undercounts = sum(1 for r in results if r['is_undercount'])
        overcounts = sum(1 for r in results if r['is_overcount'])
        
        # Rejection reasons counts
        rejection_counts = Counter()
        for r in results:
            for reason in r['rejection_reasons']:
                rejection_counts[reason] += 1
        
        # Visibility stats
        mean_vis = np.mean([r['mean_visibility'] for r in results])
        mean_side_ratio = np.mean([r['side_view_ratio'] for r in results])
        
        # ROM stats
        roms = [r['primary_rom'] for r in results]
        rom_above_floor = sum(1 for r in results if r['rom_above_floor'])
        
        # Side mode and joint info
        joint_triplet = f"{results[0]['primary_joint']} ({results[0]['left_rom']:.1f}/{results[0]['right_rom']:.1f})"
        config_rom = results[0]['config_rom']
        config_direction = results[0]['config_direction']
        side_mode = results[0]['side_mode']
        
        # Best candidate joint
        best_candidates = [r['best_candidate'] for r in results if r['best_candidate']]
        best_candidate_summary = None
        if best_candidates:
            # Most common best joint
            joint_counts = Counter(bc['joint'] for bc in best_candidates if bc['joint'])
            if joint_counts:
                most_common = joint_counts.most_common(1)[0]
                best_candidate_summary = {
                    'best_joint': most_common[0],
                    'frequency': most_common[1],
                    'avg_rom': np.mean([bc['rom'] for bc in best_candidates if bc['joint'] == most_common[0]]),
                    'config_joint': results[0]['primary_joint'],
                    'config_rom': config_rom,
                }
        
        # Worst 3 clips with angle curves + cycle_bounds
        worst_details = []
        for w in worst_per_class[cls]:
            # Re-load to get angle curve
            data = np.load(w['cache_path'], allow_pickle=True)
            landmarks = data['landmarks']
            cycle_bounds = json.loads(w['cycle_bounds_json']) if w['cycle_bounds_json'] else []
            
            # Compute primary joint angles for plotting
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
            'best_candidate_joint': best_candidate_summary,
            'worst_3_clips': worst_details,
        }
    
    return report

def main():
    parser = argparse.ArgumentParser(description='PhysiqueQuest RepCount Evaluation')
    parser.add_argument('--mode', choices=['all', 'validation', 'test', 'train'], default='all',
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
            (OUT / 'validation_results.json').write_text(json.dumps(val_result['results'], indent=2))
            (OUT / 'validation_summary.json').write_text(json.dumps(val_result['summary'], indent=2))
            (OUT / 'validation_exclusions.json').write_text(json.dumps(val_result['exclusions'], indent=2))
            print(f"\nValidation Summary:")
            for cls, stats in sorted(val_result['summary'].items()):
                if cls != 'ALL':
                    print(f"  {cls}: n={stats['n']}, MAE={stats['mae']:.2f}, nMAE={stats['normalized_mae']:.3f}, exact={stats['exact_pct']:.1f}%, within1={stats['within1_pct']:.1f}%, MSE={stats['mean_signed_error']:.2f}, det={stats['detection_pct']:.1f}%")
            overall = val_result['summary']['ALL']
            print(f"  OVERALL: n={overall['n']}, MAE={overall['mae']:.2f}, exact={overall['exact_pct']:.1f}%, within1={overall['within1_pct']:.1f}%, MSE={overall['mean_signed_error']:.2f}")
            print(f"  Excluded: {val_result['exclusions']}")
            if val_result['coordinate_check']:
                print(f"  16:9 harness-vs-raw: {val_result['coordinate_check']}")
    
    if args.mode in ['all', 'test']:
        print("\n" + "="*60)
        print("=== TEST PHASE (FROZEN SETTINGS) ===")
        print("="*60)
        (OUT / 'frozen_settings.json').write_text(json.dumps(freeze, indent=2))
        test_result = run_validation_test_phase('test', mapping, labels, freeze)
        if test_result:
            all_results['test'] = test_result
            (OUT / 'test_results.json').write_text(json.dumps(test_result['results'], indent=2))
            (OUT / 'test_summary.json').write_text(json.dumps(test_result['summary'], indent=2))
            (OUT / 'test_exclusions.json').write_text(json.dumps(test_result['exclusions'], indent=2))
            print(f"\nTest Summary:")
            for cls, stats in sorted(test_result['summary'].items()):
                if cls != 'ALL':
                    print(f"  {cls}: n={stats['n']}, MAE={stats['mae']:.2f}, nMAE={stats['normalized_mae']:.3f}, exact={stats['exact_pct']:.1f}%, within1={stats['within1_pct']:.1f}%, MSE={stats['mean_signed_error']:.2f}, det={stats['detection_pct']:.1f}%")
            overall = test_result['summary']['ALL']
            print(f"  OVERALL: n={overall['n']}, MAE={overall['mae']:.2f}, exact={overall['exact_pct']:.1f}%, within1={overall['within1_pct']:.1f}%, MSE={overall['mean_signed_error']:.2f}")
            print(f"  Excluded: {test_result['exclusions']}")
            if test_result['coordinate_check']:
                print(f"  16:9 harness-vs-raw: {test_result['coordinate_check']}")
    
    if args.mode in ['all', 'train']:
        print("\n" + "="*60)
        print("=== TRAIN FAILURE ANALYSIS ===")
        print("="*60)
        train_report = run_train_failure_analysis(mapping, labels)
        all_results['train'] = train_report
        (OUT / 'train_failure_analysis.json').write_text(json.dumps(train_report, indent=2))
        print("\nTrain Failure Analysis Summary:")
        for cls, stats in sorted(train_report.items()):
            print(f"\n  {cls}:")
            print(f"    Videos analyzed: {stats['videos_analyzed']}")
            print(f"    MAE: {stats['mae_mean']:.2f} ± {stats['mae_std']:.2f} (range {stats['mae_range'][0]:.1f}-{stats['mae_range'][1]:.1f})")
            print(f"    Mean signed error: {stats['mean_signed_error']:.2f}")
            print(f"    Undercounts: {stats['undercounts']}, Overcounts: {stats['overcounts']}")
            print(f"    Rejection reasons: {stats['rejection_reasons']}")
            print(f"    Mean visibility: {stats['mean_visibility']:.3f}, Side view ratio: {stats['mean_side_view_ratio']:.3f}")
            print(f"    Primary ROM: {stats['primary_rom_mean']:.1f}° (config: {stats['config_rom']:.1f}°), Above 30° floor: {stats['rom_above_floor_pct']:.1f}%")
            print(f"    Joint triplet: {stats['joint_triplet']}, Side mode: {stats['side_mode']}, Direction: {stats['config_direction']}")
            if stats['best_candidate_joint']:
                bc = stats['best_candidate_joint']
                print(f"    Best candidate joint: {bc['best_joint']} (ROM={bc['avg_rom']:.1f}°) vs config {bc['config_joint']} (ROM={bc['config_rom']:.1f}°)")
            print(f"    Worst 3 clips:")
            for w in stats['worst_3_clips']:
                print(f"      {w['video_id']}: gt={w['gt']}, pred={w['predicted']}, mae={w['mae']}, reasons={w['rejection_reasons']}")
    
    # Generate FINAL_REPORT.json if we have both val and test
    if 'validation' in all_results and 'test' in all_results:
        classes = ['squat', 'push_up', 'bench_press', 'front_raise', 'pull_up', 'situp', 'jumping_jack']
        per_class = {}
        for cls in classes:
            val_info = all_results['validation']['summary'].get(cls)
            test_info = all_results['test']['summary'].get(cls)
            test_reliable = test_info and test_info['within1_pct'] >= 70.0
            val_reliable = val_info and val_info['within1_pct'] >= 70.0
            per_class[cls] = {
                'validation': val_info,
                'test': test_info,
                'reliable_on_test': test_reliable,
                'reliable_on_val': val_reliable,
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
            },
            'notes': 'Test run once with frozen settings. No tuning on test set.',
        }
        (OUT / 'FINAL_REPORT.json').write_text(json.dumps(final_report, indent=2))
        print(f"\nFINAL_REPORT.json written")
    
    print("\n" + "="*60)
    print("EVALUATION COMPLETE")
    print("="*60)

if __name__ == '__main__':
    main()