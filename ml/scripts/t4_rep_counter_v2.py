#!/usr/bin/env python3
"""T4: Improved rep counter with proper hysteresis and state machine."""
import json
import numpy as np
import re
from pathlib import Path
from scipy.ndimage import gaussian_filter1d

with open("configs/pushupbench_taxonomy_mapping.json") as f:
    pb_mapping = json.load(f)

PATTERN_JOINTS = {
    "squat": [24, 26, 28], "lunge": [24, 26, 28],
    "curl": [12, 14, 16], "horizontal_push": [12, 14, 16],
    "vertical_push": [12, 14, 16], "horizontal_pull": [12, 14, 16],
    "vertical_pull": [12, 14, 16], "triceps_extension": [12, 14, 16],
    "lateral_raise": [12, 14, 16], "front_raise": [12, 14, 16],
    "rear_delt": [12, 14, 16], "hinge": [24, 26, 28],
    "hip_thrust_bridge": [24, 26, 28], "calf_raise": [24, 26, 28],
    "core_flexion": [11, 23, 25], "rotation": [11, 23, 25],
    "core_isometric": [11, 23, 25], "cardio_dynamic": [24, 26, 28],
    "carry_locomotion": [24, 26, 28],
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

def count_reps_state_machine(angle_signal, fps=15.0, min_rom_frac=0.85, min_rep_dur=0.5, max_rep_dur=4.0):
    """
    State machine rep counter:
    - Track direction (flexion/extension) from expected pattern
    - Use hysteresis thresholds (enter/exit)
    - Require minimum duration between reps
    - Validate ROM per rep
    """
    if len(angle_signal) < 10:
        return 0, []
    
    smooth = gaussian_filter1d(angle_signal, sigma=2.0)  # More smoothing
    
    # Determine overall direction
    start_angle = np.mean(smooth[:10])
    end_angle = np.mean(smooth[-10:])
    direction = "flexion" if end_angle < start_angle else "extension"
    
    # Expected ROM
    if direction == "flexion":
        expected_rom = start_angle - np.min(smooth)
        # Thresholds: enter at 80% down, exit at 20% down (hysteresis)
        enter_thresh = start_angle - 0.8 * expected_rom
        exit_thresh = start_angle - 0.2 * expected_rom
    else:
        expected_rom = np.max(smooth) - start_angle
        enter_thresh = start_angle + 0.8 * expected_rom
        exit_thresh = start_angle + 0.2 * expected_rom
    
    min_rom = expected_rom * min_rom_frac
    min_frames = int(min_rep_dur * fps)
    max_frames = int(max_rep_dur * fps)
    
    state = "up"  # "up", "down", "validating"
    rep_count = 0
    rep_details = []
    rep_start = 0
    last_extreme_idx = -min_frames
    
    for i, angle in enumerate(smooth):
        if state == "up":
            if direction == "flexion" and angle <= enter_thresh:
                state = "down"
                rep_start = i
            elif direction == "extension" and angle >= enter_thresh:
                state = "down"
                rep_start = i
        
        elif state == "down":
            # Check if we've gone deep enough and come back up
            if direction == "flexion" and angle >= exit_thresh:
                rep_dur = (i - rep_start) / fps
                if min_frames <= (i - rep_start) <= max_frames:
                    # Calculate actual ROM for this rep
                    rep_segment = smooth[rep_start:i+1]
                    if len(rep_segment) >= 3:
                        rom = np.max(rep_segment) - np.min(rep_segment)
                        if rom >= min_rom:
                            rep_count += 1
                            rep_details.append({
                                "peak_frame": int(np.argmax(rep_segment) + rep_start) if direction == "extension" else int(np.argmin(rep_segment) + rep_start),
                                "start_frame": int(rep_start),
                                "end_frame": int(i),
                                "rom": float(rom),
                                "expected_rom": float(expected_rom),
                                "rom_fraction": float(rom / expected_rom) if expected_rom > 0 else 0,
                                "duration_sec": float(rep_dur),
                            })
                state = "up"
                last_extreme_idx = i
            elif direction == "extension" and angle <= exit_thresh:
                rep_dur = (i - rep_start) / fps
                if min_frames <= (i - rep_start) <= max_frames:
                    rep_segment = smooth[rep_start:i+1]
                    if len(rep_segment) >= 3:
                        rom = np.max(rep_segment) - np.min(rep_segment)
                        if rom >= min_rom:
                            rep_count += 1
                            rep_details.append({
                                "peak_frame": int(np.argmax(rep_segment) + rep_start),
                                "start_frame": int(rep_start),
                                "end_frame": int(i),
                                "rom": float(rom),
                                "expected_rom": float(expected_rom),
                                "rom_fraction": float(rom / expected_rom) if expected_rom > 0 else 0,
                                "duration_sec": float(rep_dur),
                            })
                state = "up"
                last_extreme_idx = i
    
    return rep_count, rep_details

def main():
    results = []
    
    for npz_path in npz_files:
        vn = npz_path.stem
        gt_reps, rep_type = parse_rep_count(vn)
        if gt_reps is None or rep_type != "single":
            continue
        
        parts = vn.split('_')
        if len(parts) >= 3:
            ex_name = '_'.join(parts[2:])
        else:
            ex_name = vn
        ex_name = re.sub(r'\s*_?\[\d+(?:-\d+)*\]\s*$', '', ex_name)
        
        pattern = pb_mapping.get(ex_name, "unknown")
        if pattern not in PATTERN_JOINTS:
            continue
        
        joints = PATTERN_JOINTS[pattern]
        
        data = np.load(npz_path)
        keypoints = data["keypoints"]
        
        angles = []
        for t in range(keypoints.shape[0]):
            a, b, c = keypoints[t, joints[0], :3], keypoints[t, joints[1], :3], keypoints[t, joints[2], :3]
            ba = a - b; bc = c - b
            cosine = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-8)
            angle = np.degrees(np.arccos(np.clip(cosine, -1, 1)))
            angles.append(angle)
        
        pred_reps, rep_details = count_reps_state_machine(np.array(angles), fps=15.0)
        error = abs(pred_reps - gt_reps)
        
        results.append({
            "video": vn,
            "exercise": ex_name,
            "pattern": pattern,
            "gt_reps": gt_reps,
            "pred_reps": pred_reps,
            "error": error,
            "rep_details": rep_details,
        })
        
        print(f"{vn}: GT={gt_reps}, Pred={pred_reps}, Err={error}, Pattern={pattern}")
        if rep_details:
            for rd in rep_details[:5]:
                print(f"  Rep: rom={rd['rom']:.1f}, rom_frac={rd['rom_fraction']:.2f}, dur={rd['duration_sec']:.2f}s")
    
    errors = [r["error"] for r in results]
    if errors:
        mae = np.mean(errors)
        exact = sum(1 for e in errors if e == 0)
        off_by_1 = sum(1 for e in errors if e <= 1)
        print(f"\n=== STATE MACHINE REP COUNTING (n={len(errors)}) ===")
        print(f"MAE: {mae:.2f}")
        print(f"Exact: {exact}/{len(errors)} = {exact/len(errors)*100:.1f}%")
        print(f"Off-by-1: {off_by_1}/{len(errors)} = {off_by_1/len(errors)*100:.1f}%")
        
        worst = sorted(results, key=lambda x: x["error"], reverse=True)[:3]
        print(f"\nWorst 3:")
        for r in worst:
            print(f"  {r['video']}: GT={r['gt_reps']}, Pred={r['pred_reps']}, Err={r['error']}")
    
    OUT_DIR = Path("reports/t4_rep_counter")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUT_DIR / "pushupbench_sm_rep_results.json", "w") as f:
        json.dump(results, f, indent=2, default=str)
    print(f"\nSaved to {OUT_DIR}/pushupbench_sm_rep_results.json")

if __name__ == "__main__":
    main()