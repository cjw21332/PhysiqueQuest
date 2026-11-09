"""Rep counting, ROM, tempo from keypoint sequences."""
import numpy as np
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from pathlib import Path
import json


@dataclass
class RepConfig:
    """Configuration for a specific exercise's rep counting."""
    exercise_id: str
    name: str
    pattern: str
    primary_joints: List[int]  # e.g., [24, 26, 28] for left knee
    start_angle: float  # degrees at start position
    peak_angle: float   # degrees at peak flexion/extension
    direction: str      # "flexion" or "extension" - angle decreases/increases
    rep_period_range: Tuple[float, float]  # expected min/max seconds per rep
    side_mode: str      # "bilateral", "unilateral_left", "unilateral_right"
    min_rom_fraction: float = 0.85  # minimum ROM as fraction of expected
    min_visibility: float = 0.5
    stability_frames: int = 3  # frames to confirm peak/valley
    validation_status: str = "pending"


def compute_angle(a: np.ndarray, b: np.ndarray, c: np.ndarray) -> float:
    """Angle at b from a->b->c, returns degrees."""
    ba = a - b
    bc = c - b
    cosine = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-8)
    return np.degrees(np.arccos(np.clip(cosine, -1, 1)))


def smooth_signal(signal: np.ndarray, window: int = 5) -> np.ndarray:
    """Simple moving average smoothing."""
    if len(signal) < window:
        return signal
    kernel = np.ones(window) / window
    return np.convolve(signal, kernel, mode='same')


def detect_peaks_valleys(
    signal: np.ndarray,
    prominence: float = 5.0,
    distance: int = 8
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Detect peaks (local maxima) and valleys (local minima) in angle signal.
    Returns indices of peaks and valleys.
    """
    from scipy.signal import find_peaks
    
    # Peaks
    peaks, _ = find_peaks(signal, prominence=prominence, distance=distance)
    
    # Valleys (peaks of inverted signal)
    valleys, _ = find_peaks(-signal, prominence=prominence, distance=distance)
    
    return peaks, valleys


def count_reps(
    angle_signal: np.ndarray,
    config: RepConfig,
    fps: float = 15.0
) -> Dict:
    """
    Count reps from primary joint angle signal.
    Returns dict with count, timestamps, and quality metrics.
    """
    if len(angle_signal) < 10:
        return {"count": 0, "reps": [], "quality": "insufficient_frames"}
    
    # Smooth the signal
    smooth = smooth_signal(angle_signal, window=5)
    
    # Determine if we're looking for peaks or valleys based on direction
    if config.direction == "flexion":
        # Angle decreases during flexion -> valleys are reps
        peaks, valleys = detect_peaks_valleys(smooth)
        rep_events = valleys  # bottom of squat/curl
        event_type = "valley"
    else:
        # Extension -> peaks are reps
        peaks, valleys = detect_peaks_valleys(smooth)
        rep_events = peaks
        event_type = "peak"
    
    # Filter by expected period
    min_period = int(config.rep_period_range[0] * fps)
    max_period = int(config.rep_period_range[1] * fps)
    
    valid_reps = []
    for i, idx in enumerate(rep_events):
        if i == 0:
            valid_reps.append(idx)
        else:
            period = idx - rep_events[i-1]
            if min_period <= period <= max_period:
                valid_reps.append(idx)
            # else: too fast or too slow, might be noise
    
    # Calculate ROM for each rep
    reps_info = []
    for idx in valid_reps:
        # Find start and end of this rep (halfway to adjacent events)
        start_idx = 0 if idx == valid_reps[0] else (valid_reps[valid_reps.index(idx)-1] + idx) // 2
        end_idx = len(smooth)-1 if idx == valid_reps[-1] else (idx + valid_reps[valid_reps.index(idx)+1]) // 2
        
        rep_segment = smooth[start_idx:end_idx+1]
        if len(rep_segment) < 3:
            continue
        
        rom = np.max(rep_segment) - np.min(rep_segment)
        expected_rom = abs(config.peak_angle - config.start_angle)
        rom_fraction = rom / expected_rom if expected_rom > 0 else 0
        
        # Tempo: time from start to peak + peak to end
        rep_time = len(rep_segment) / fps
        
        reps_info.append({
            "peak_frame": int(idx),
            "start_frame": int(start_idx),
            "end_frame": int(end_idx),
            "rom_degrees": float(rom),
            "rom_fraction": float(rom_fraction),
            "tempo_seconds": float(rep_time),
            "quality": "full" if rom_fraction >= config.min_rom_fraction else "partial",
        })
    
    return {
        "count": len(valid_reps),
        "reps": reps_info,
        "total_time": len(smooth) / fps,
        "avg_tempo": np.mean([r["tempo_seconds"] for r in reps_info]) if reps_info else 0,
    }


def generate_angle_configs_from_gifs() -> List[RepConfig]:
    """
    Generate RepConfig for each trackable exercise from GIF keypoints.
    Reads exercise_ml_map.json for primary joint info.
    """
    with open("data/exercise_ml_map.json") as f:
        ml_map = json.load(f)
    
    # Primary joint triplets for each pattern
    pattern_joints = {
        "squat": [24, 26, 28],          # left hip-knee-ankle
        "lunge": [24, 26, 28],
        "curl": [12, 14, 16],           # right shoulder-elbow-wrist
        "horizontal_push": [12, 14, 16],
        "vertical_push": [12, 14, 16],
        "horizontal_pull": [12, 14, 16],
        "vertical_pull": [12, 14, 16],
        "triceps_extension": [12, 14, 16],
        "lateral_raise": [12, 14, 16],
        "front_raise": [12, 14, 16],
        "rear_delt": [12, 14, 16],
        "hinge": [24, 26, 28],
        "hip_thrust_bridge": [24, 26, 28],
        "calf_raise": [24, 26, 28],
        "core_flexion": [11, 23, 25],   # shoulder-hip-knee (approx)
        "rotation": [11, 23, 25],
        "core_isometric": [11, 23, 25],
        "cardio_dynamic": [24, 26, 28],
        "carry_locomotion": [24, 26, 28],
    }
    
    # Expected angle ranges per pattern (start, peak)
    pattern_angles = {
        "squat": (170, 90),       # standing ~170, bottom ~90
        "lunge": (170, 90),
        "curl": (160, 40),        # arm straight ~160, curled ~40
        "horizontal_push": (170, 90),
        "vertical_push": (170, 90),
        "horizontal_pull": (160, 60),
        "vertical_pull": (160, 60),
        "triceps_extension": (40, 160),  # reverse of curl
        "lateral_raise": (10, 120),
        "front_raise": (10, 120),
        "rear_delt": (10, 90),
        "hinge": (170, 90),
        "hip_thrust_bridge": (170, 90),
        "calf_raise": (170, 90),  # ankle angle
        "core_flexion": (170, 60),
        "rotation": (170, 90),
        "core_isometric": (170, 170),  # static
        "cardio_dynamic": (170, 90),
        "carry_locomotion": (170, 90),
    }
    
    # Direction: flexion (angle decreases) or extension (angle increases)
    pattern_direction = {
        "squat": "flexion",
        "lunge": "flexion",
        "curl": "flexion",
        "horizontal_push": "flexion",
        "vertical_push": "flexion",
        "horizontal_pull": "flexion",
        "vertical_pull": "flexion",
        "triceps_extension": "extension",
        "lateral_raise": "extension",  # abduction
        "front_raise": "extension",
        "rear_delt": "extension",
        "hinge": "flexion",
        "hip_thrust_bridge": "extension",
        "calf_raise": "flexion",
        "core_flexion": "flexion",
        "rotation": "flexion",
        "core_isometric": "flexion",
        "cardio_dynamic": "flexion",
        "carry_locomotion": "flexion",
    }
    
    configs = []
    for ex_id, entry in ml_map.items():
        if not entry.get("trackable", False):
            continue
        
        pattern = entry.get("movement_pattern", "unknown")
        if pattern not in pattern_joints:
            continue
        
        joints = pattern_joints[pattern]
        start_angle, peak_angle = pattern_angles.get(pattern, (170, 90))
        direction = pattern_direction.get(pattern, "flexion")
        
        config = RepConfig(
            exercise_id=ex_id,
            name=entry.get("name", "unknown"),
            pattern=pattern,
            primary_joints=joints,
            start_angle=start_angle,
            peak_angle=peak_angle,
            direction=direction,
            rep_period_range=(0.8, 3.0),  # 0.8-3 seconds per rep
            side_mode="bilateral",
            min_rom_fraction=0.85,
            validation_status="pending",
        )
        configs.append(config)
    
    return configs


def extract_primary_angle(keypoints: np.ndarray, joints: List[int]) -> np.ndarray:
    """Extract angle time series from keypoints for given joint triplet."""
    # keypoints: (T, 33, 4)
    angles = []
    for t in range(keypoints.shape[0]):
        a, b, c = keypoints[t, joints[0], :3], keypoints[t, joints[1], :3], keypoints[t, joints[2], :3]
        angle = compute_angle(a, b, c)
        angles.append(angle)
    return np.array(angles)


def main():
    configs = generate_angle_configs_from_gifs()
    print(f"Generated {len(configs)} angle configs")
    
    # Save
    output_path = Path("ml/models/generated_angle_configs.json")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, "w") as f:
        json.dump([{
            "exercise_id": c.exercise_id,
            "name": c.name,
            "pattern": c.pattern,
            "primary_joints": c.primary_joints,
            "start_angle": c.start_angle,
            "peak_angle": c.peak_angle,
            "direction": c.direction,
            "rep_period_range": c.rep_period_range,
            "side_mode": c.side_mode,
            "min_rom_fraction": c.min_rom_fraction,
            "min_visibility": c.min_visibility,
            "stability_frames": c.stability_frames,
            "validation_status": c.validation_status,
        } for c in configs], f, indent=2)
    
    print(f"Saved to {output_path}")
    
    # Test on a few exercises
    print("\n=== Test Rep Counting ===")
    for config in configs[:3]:
        print(f"\n{config.exercise_id} ({config.name}) - {config.pattern}")
        print(f"  Joints: {config.primary_joints}")
        print(f"  Angles: start={config.start_angle}, peak={config.peak_angle}")
        print(f"  Direction: {config.direction}")


if __name__ == "__main__":
    main()