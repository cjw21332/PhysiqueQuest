#!/usr/bin/env python3
"""T4: Rep counter with correct joint selection per exercise."""
import json
import numpy as np
import re
from pathlib import Path
from scipy.ndimage import gaussian_filter1d
from scipy.signal import find_peaks

with open("configs/pushupbench_taxonomy_mapping.json") as f:
    pb_mapping = json.load(f)

# Exercise-specific joint triplets (from angle config derivation)
EXERCISE_JOINTS = {
    "c-curl twist": [11, 13, 15],  # LEFT shoulder-elbow-wrist
    "knee to chest": [11, 23, 25],
    "bent scissor": [11, 23, 25],
    "toe taps": [11, 23, 25],
    "leg extension + crunch [l]": [11, 23, 25],
    "leg extension + crunch [r]": [11, 23, 25],
    "side crunch + leg stretch [l]": [11, 23, 25],
    "side crunch + leg stretch [r]": [11, 23, 25],
    "reverse lunges challenge": [24, 26, 28],  # LEFT hip-knee-ankle
    "leg lift": [24, 26, 28],
    "drop squats": [24, 26, 28],
    "push up toe tap": [12, 14, 16],
    "side plank raises(right side)": [11, 23, 25],
    "slow sq": [24, 26, 28],
    "step jacks": [24, 26, 28],
    "wall push": [12, 14, 16],
    "kickback(l)": [12, 14, 16],
    "bicep curls": [11, 13, 15],
    "box push-ups": [12, 14, 16],
    "push up (on knees)": [12, 14, 16],
    "donkey kicks": [24, 26, 28],
    "donkey twist": [24, 26, 28],
    "1 leg bridge(r)": [24, 26, 28],
    "alternating side crunch": [11, 23, 25],
}

KEYPOINTS_DIR = Path("data/keypoints_full")
npz_files = sorted(KEYPOINTS_DIR.glob("*.npz"))

def parse_rep_count(filename):
    match = re.search(r'_\[(\d+(?:-\d+)*)\]', filename)
    if match:
        parts = match.group(1).split('-')
        if len(parts) == 1:
            return int(parts[0]), "single"
        else:
            return sum(int(p) for p in parts) / len(parts), "multi"
    return None, "none"

def count_reps_peaks_valleys(angle_signal, fps=15.0):
    """Count reps using peaks/valleys with proper direction detection."""
    if len(angle_signal) < 10:
        return 0, []
    
    smooth = gaussian_filter1d(angle_signal, sigma=2.0)
    
    # Find peaks and valleys
    peaks, _ = find_peaks(smooth, prominence=5, distance=8)
    valleys, _ = find_peaks(-smooth, prominence=5, distance=8)
    
    if len(peaks) == 0 and len(valleys) == 0:
        return 0, []
    
    # Determine direction from peak vs valley angles
    peak_angles = smooth[peaks] if len(peaks) > 0 else np.array([smooth[0]])
    valley_angles = smooth[valleys] if len(valleys) > 0 else np.array([smooth[-1]])
    
    mean_peak = np.mean(peak_angles)
    mean_valley = np.mean(valley_angles)
    
    if mean_peak > mean_valley:
        # Extension at peaks, flexion at valleys -> reps at valleys
        direction = "flexion"
        rep_count = len(valleys)
        rep_indices = valleys
    else:
        # Flexion at peaks, extension at valleys -> reps at peaks
        direction = "extension"
        rep_count = len(peaks)
        rep_indices = peaks
    
    # Expected ROM
    expected_rom = abs(mean_peak - mean_valley)
    
    # Filter by ROM
    valid_reps = []
    rep_details = []
    for idx in rep_indices:
        # Find rep boundaries (halfway to adjacent extrema)
        all_extrema = np.sort(np.concatenate([peaks, valleys]))
        pos = np.where(all_extrema == idx)[0][0]
        start_idx = 0 if pos == 0 else (all_extrema[pos-1] + idx) // 2
        end_idx = len(smooth)-1 if pos == len(all_extrema)-1 else (idx + all_extrema[pos+1]) // 2
        
        rep_segment = smooth[start_idx:end_idx+1]
        if len(rep_segment) < 3:
            continue
        rom = np.max(rep_segment) - np.min(rep_segment)
        rom_frac = rom / expected_rom if expected_rom > 0 else 0
        
        if rom_frac >= 0.85:  # min ROM fraction
            valid_reps.append(idx)
            rep_details.append({
                "peak_frame": int(idx),
                "start_frame": int(start_idx),
                "end_frame": int(end_idx),
                "rom": float(rom),
                "expected_rom": float(expected_rom),
                "rom_fraction": float(rom_frac),
                "duration_sec": float((end_idx - start_idx) / fps),
            })
    
    return len(valid_reps), rep_details

def main():
    results = []
    
    for npz_path in npz_files:
        vn = npz_path.stem
        gt_reps, rep_type = parse_rep_count(vn)
        if gt_reps is None or rep_type != "single":
            continue
        
        # Get exercise-specific joints
        ex_name = vn
        parts = vn.split('_')
        if len(parts) >= 3:
            ex_name = '_'.join(parts[2:])
        ex_name = re.sub(r'\s*_?\[\d+(?:-\d+)*\]\s*$', '', ex_name)
        
        if ex_name not in EXERCISE_JOINTS:
            print(f"  SKIP: No joint config for {ex_name}")
            continue
        
        joints = EXERCISE_JOINTS[ex_name]
        
        data = np.load(npz_path)
        keypoints = data["keypoints"]
        
        angles = []
        for t in range(keypoints.shape[0]):
            a, b, c = keypoints[t, joints[0], :3], keypoints[t, joints[1], :3], keypoints[t, joints[2], :3]
            ba = a - b; bc = c - b
            cosine = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-8)
            angle = np.degrees(np.arccos(np.clip(cosine, -1, 1)))
            angles.append(angle)
        
        pred_reps, rep_details = count_reps_peaks_valleys(np.array(angles), fps=15.0)
        error = abs(pred_reps - gt_reps)
        
        results.append({
            "video": vn,
            "exercise": ex_name,
            "joints": joints,
            "gt_reps": gt_reps,
            "pred_reps": pred_reps,
            "error": error,
            "rep_details": rep_details,
        })
        
        print(f"{vn}: GT={gt_reps}, Pred={pred_reps}, Err={error}, Joints={joints}")
        if rep_details:
            for rd in rep_details[:3]:
                print(f"  Rep: rom={rd['rom']:.1f}, rom_frac={rd['rom_fraction']:.2f}, dur={rd['duration_sec']:.2f}s")
    
    errors = [r["error"] for r in results]
    if errors:
        mae = np.mean(errors)
        exact = sum(1 for e in errors if e == 0)
        off_by_1 = sum(1 for e in errors if e <= 1)
        print(f"\n=== EXERCISE-SPECIFIC REP COUNTING (n={len(errors)}) ===")
        print(f"MAE: {mae:.2f}")
        print(f"Exact: {exact}/{len(errors)} = {exact/len(errors)*100:.1f}%")
        print(f"Off-by-1: {off_by_1}/{len(errors)} = {off_by_1/len(errors)*100:.1f}%")
        
        worst = sorted(results, key=lambda x: x["error"], reverse=True)[:3]
        print(f"\nWorst 3:")
        for r in worst:
            print(f"  {r['video']}: GT={r['gt_reps']}, Pred={r['pred_reps']}, Err={r['error']}")
    
    OUT_DIR = Path("reports/t4_rep_counter")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUT_DIR / "pushupbench_exercise_rep_results.json", "w") as f:
        json.dump(results, f, indent=2, default=str)
    print(f"\nSaved to {OUT_DIR}/pushupbench_exercise_rep_results.json")

if __name__ == "__main__":
    main()