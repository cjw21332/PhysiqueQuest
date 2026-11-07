"""
Angle Series Computation

Computes 2D joint angles per frame from MediaPipe landmarks.
Uses pixel-aspect-corrected x/y coordinates (ignores z).
"""

import numpy as np
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from tqdm import tqdm
from scipy.signal import savgol_filter
from scipy.interpolate import interp1d

from config import (
    LANDMARK_CACHE_DIR,
    MIN_LANDMARK_VIS,
    MAX_INTERPOLATION_GAP_FRAMES,
    SAVGOL_WINDOW,
    SAVGOL_POLYORDER,
    JOINT_DEFINITIONS,
    SIDE_JOINTS,
    LANDMARK_NAMES,
    LOGGER,
)
from extract_landmarks import ExerciseLandmarks, FrameLandmarks, load_landmarks


@dataclass
class AngleSeries:
    joint_name: str
    angles: np.ndarray  # degrees, NaN for invalid
    valid_mask: np.ndarray  # boolean
    timestamps: np.ndarray  # ms
    frame_indices: np.ndarray


@dataclass
class ExerciseAngles:
    exerciseId: str
    fps: float
    frame_count: int
    duration_ms: float
    person_detected_fraction: float
    angle_series: Dict[str, AngleSeries]
    trunk_inclination: Optional[AngleSeries] = None


def compute_angle_2d(
    p1: np.ndarray, p2: np.ndarray, p3: np.ndarray, aspect: float
) -> Optional[float]:
    """
    Compute 2D angle ABC (at B) with pixel aspect correction.
    Points are in normalized coordinates [0,1] x [0,1].
    """
    # Apply aspect correction to x coordinates
    ax = (p1[0] - p2[0]) * aspect
    ay = p1[1] - p2[1]
    cx = (p3[0] - p2[0]) * aspect
    cy = p3[1] - p2[1]

    # Check for degenerate cases (coincident or near-coincident points)
    dist_ab = np.hypot(ax, ay)
    dist_cb = np.hypot(cx, cy)
    if dist_ab < 1e-6 or dist_cb < 1e-6:
        return None

    # Compute angle
    dot = ax * cx + ay * cy
    cos_angle = np.clip(dot / (dist_ab * dist_cb), -1.0, 1.0)
    angle = np.arccos(cos_angle) * 180.0 / np.pi
    return angle


def compute_trunk_inclination(
    landmarks: List[Dict[str, float]], aspect: float
) -> Optional[float]:
    """
    Compute trunk inclination: angle between hip-midpoint to shoulder-midpoint line and vertical.
    Returns angle in degrees (0 = vertical).
    """
    required = [11, 12, 23, 24]  # left/right shoulder, left/right hip
    for idx in required:
        if idx >= len(landmarks) or landmarks[idx]["visibility"] < MIN_LANDMARK_VIS:
            return None

    ls = landmarks[11]
    rs = landmarks[12]
    lh = landmarks[23]
    rh = landmarks[24]

    # Midpoints
    shoulder_mid_x = (ls["x"] + rs["x"]) / 2
    shoulder_mid_y = (ls["y"] + rs["y"]) / 2
    hip_mid_x = (lh["x"] + rh["x"]) / 2
    hip_mid_y = (lh["y"] + rh["y"]) / 2

    # Vector from hip to shoulder
    dx = (shoulder_mid_x - hip_mid_x) * aspect
    dy = shoulder_mid_y - hip_mid_y

    if abs(dx) < 1e-6 and abs(dy) < 1e-6:
        return None

    # Angle from vertical (0, -1)
    # atan2(dx, -dy) gives angle from vertical
    angle = np.arctan2(dx, -dy) * 180.0 / np.pi
    return angle


def interpolate_gaps(angles: np.ndarray, max_gap: int) -> np.ndarray:
    """Interpolate NaN gaps of length <= max_gap."""
    result = angles.copy()
    n = len(angles)

    i = 0
    while i < n:
        if np.isnan(result[i]):
            # Find gap end
            j = i
            while j < n and np.isnan(result[j]):
                j += 1
            gap_len = j - i

            if gap_len <= max_gap and i > 0 and j < n:
                # Interpolate
                x = np.array([i - 1, j])
                y = np.array([result[i - 1], result[j]])
                interp = interp1d(x, y, kind='linear')
                result[i:j] = interp(np.arange(i, j))
            i = j
        else:
            i += 1

    return result


def smooth_angles(angles: np.ndarray, window: int = SAVGOL_WINDOW, polyorder: int = SAVGOL_POLYORDER) -> np.ndarray:
    """Apply Savitzky-Golay filter to smooth angles, preserving NaN positions."""
    result = angles.copy()
    valid_mask = ~np.isnan(result)
    n = len(angles)

    if np.sum(valid_mask) < window:
        # Not enough valid points for Savitzky-Golay, use moving average
        return moving_average_preserve_nan(result, window)

    # Get contiguous valid segments
    i = 0
    while i < n:
        if valid_mask[i]:
            j = i
            while j < n and valid_mask[j]:
                j += 1
            segment_len = j - i
            if segment_len >= window:
                segment = result[i:j]
                smoothed = savgol_filter(segment, window, polyorder)
                result[i:j] = smoothed
            i = j
        else:
            i += 1

    return result


def moving_average_preserve_nan(angles: np.ndarray, window: int) -> np.ndarray:
    """Simple moving average preserving NaN positions."""
    result = angles.copy()
    n = len(angles)
    half = window // 2

    for i in range(n):
        if np.isnan(result[i]):
            continue
        # Collect valid neighbors
        vals = []
        for j in range(max(0, i - half), min(n, i + half + 1)):
            if not np.isnan(result[j]):
                vals.append(result[j])
        if vals:
            result[i] = np.mean(vals)

    return result


def compute_angle_series(
    landmarks: ExerciseLandmarks,
    aspect: float = 1.0,  # Will compute per-frame from frame shape if needed
) -> ExerciseAngles:
    """Compute all joint angle series for an exercise."""
    n_frames = landmarks.frame_count
    timestamps = np.array([f.timestamp_ms for f in landmarks.frames])
    frame_indices = np.array([f.frame_idx for f in landmarks.frames])

    angle_series_dict = {}

    # Compute each joint angle
    for joint_name, idx_a, idx_b, idx_c in JOINT_DEFINITIONS:
        angles = np.full(n_frames, np.nan, dtype=np.float32)
        valid = np.zeros(n_frames, dtype=bool)

        for i, frame in enumerate(landmarks.frames):
            if not frame.person_detected or len(frame.landmarks) < 33:
                continue

            # Check visibility of all three points
            if (frame.landmarks[idx_a]["visibility"] < MIN_LANDMARK_VIS or
                frame.landmarks[idx_b]["visibility"] < MIN_LANDMARK_VIS or
                frame.landmarks[idx_c]["visibility"] < MIN_LANDMARK_VIS):
                continue

            # Get points
            p1 = np.array([frame.landmarks[idx_a]["x"], frame.landmarks[idx_a]["y"]])
            p2 = np.array([frame.landmarks[idx_b]["x"], frame.landmarks[idx_b]["y"]])
            p3 = np.array([frame.landmarks[idx_c]["x"], frame.landmarks[idx_c]["y"]])

            angle = compute_angle_2d(p1, p2, p3, aspect)
            if angle is not None:
                angles[i] = angle
                valid[i] = True

        # Interpolate small gaps
        angles = interpolate_gaps(angles, MAX_INTERPOLATION_GAP_FRAMES)

        # Smooth
        angles = smooth_angles(angles)

        # Update valid mask after processing
        valid = ~np.isnan(angles)

        angle_series_dict[joint_name] = AngleSeries(
            joint_name=joint_name,
            angles=angles,
            valid_mask=valid,
            timestamps=timestamps,
            frame_indices=frame_indices,
        )

    # Compute trunk inclination
    trunk_angles = np.full(n_frames, np.nan, dtype=np.float32)
    trunk_valid = np.zeros(n_frames, dtype=bool)

    for i, frame in enumerate(landmarks.frames):
        if not frame.person_detected or len(frame.landmarks) < 33:
            continue
        angle = compute_trunk_inclination(frame.landmarks, aspect)
        if angle is not None:
            trunk_angles[i] = angle
            trunk_valid[i] = True

    trunk_angles = interpolate_gaps(trunk_angles, MAX_INTERPOLATION_GAP_FRAMES)
    trunk_angles = smooth_angles(trunk_angles)
    trunk_valid = ~np.isnan(trunk_angles)

    trunk_series = AngleSeries(
        joint_name="trunk_inclination",
        angles=trunk_angles,
        valid_mask=trunk_valid,
        timestamps=timestamps,
        frame_indices=frame_indices,
    )

    return ExerciseAngles(
        exerciseId=landmarks.exerciseId,
        fps=landmarks.fps,
        frame_count=landmarks.frame_count,
        duration_ms=landmarks.duration_ms,
        person_detected_fraction=landmarks.person_detected_fraction,
        angle_series=angle_series_dict,
        trunk_inclination=trunk_series,
    )


def save_angles(angles: ExerciseAngles):
    """Save angle series to NPZ."""
    output_path = LANDMARK_CACHE_DIR / f"{angles.exerciseId}_angles.npz"

    # Prepare data for saving
    save_dict = {
        "exerciseId": angles.exerciseId,
        "fps": angles.fps,
        "frame_count": angles.frame_count,
        "duration_ms": angles.duration_ms,
        "person_detected_fraction": angles.person_detected_fraction,
    }

    for name, series in angles.angle_series.items():
        save_dict[f"angle_{name}_angles"] = series.angles
        save_dict[f"angle_{name}_valid"] = series.valid_mask
        save_dict[f"angle_{name}_timestamps"] = series.timestamps
        save_dict[f"angle_{name}_frame_indices"] = series.frame_indices

    if angles.trunk_inclination:
        save_dict["angle_trunk_inclination_angles"] = angles.trunk_inclination.angles
        save_dict["angle_trunk_inclination_valid"] = angles.trunk_inclination.valid_mask
        save_dict["angle_trunk_inclination_timestamps"] = angles.trunk_inclination.timestamps
        save_dict["angle_trunk_inclination_frame_indices"] = angles.trunk_inclination.frame_indices

    np.savez_compressed(output_path, **save_dict)
    LOGGER.debug(f"Saved angles for {angles.exerciseId}")


def load_angles(exercise_id: str) -> Optional[ExerciseAngles]:
    """Load angle series from NPZ."""
    path = LANDMARK_CACHE_DIR / f"{exercise_id}_angles.npz"
    if not path.exists():
        return None

    data = np.load(path, allow_pickle=True)
    angle_series = {}

    for key in data.keys():
        if key.startswith("angle_") and key.endswith("_angles"):
            name = key[6:-7]  # Remove "angle_" and "_angles"
            angle_series[name] = AngleSeries(
                joint_name=name,
                angles=data[key],
                valid_mask=data[f"angle_{name}_valid"],
                timestamps=data[f"angle_{name}_timestamps"],
                frame_indices=data[f"angle_{name}_frame_indices"],
            )

    trunk = None
    if "angle_trunk_inclination_angles" in data:
        trunk = AngleSeries(
            joint_name="trunk_inclination",
            angles=data["angle_trunk_inclination_angles"],
            valid_mask=data["angle_trunk_inclination_valid"],
            timestamps=data["angle_trunk_inclination_timestamps"],
            frame_indices=data["angle_trunk_inclination_frame_indices"],
        )

    return ExerciseAngles(
        exerciseId=str(data["exerciseId"]),
        fps=float(data["fps"]),
        frame_count=int(data["frame_count"]),
        duration_ms=float(data["duration_ms"]),
        person_detected_fraction=float(data["person_detected_fraction"]),
        angle_series=angle_series,
        trunk_inclination=trunk,
    )


def main():
    """Compute angles for all exercises with landmarks."""
    LOGGER.info("Starting angle computation pipeline")

    # Find all landmark files
    npz_files = list(LANDMARK_CACHE_DIR.glob("*.npz"))
    npz_files = [f for f in npz_files if not f.name.endswith("_angles.npz")]
    LOGGER.info(f"Found {len(npz_files)} landmark files")

    for npz_path in tqdm(npz_files, desc="Computing angles"):
        exercise_id = npz_path.stem
        angles_path = LANDMARK_CACHE_DIR / f"{exercise_id}_angles.npz"

        if angles_path.exists():
            continue

        try:
            landmarks = load_landmarks(exercise_id)
            if landmarks is None:
                LOGGER.warning(f"No landmarks found for {exercise_id}")
                continue

            angles = compute_angle_series(landmarks)
            save_angles(angles)
        except Exception as e:
            LOGGER.error(f"Failed to compute angles for {exercise_id}: {e}")

    LOGGER.info("Angle computation complete")


if __name__ == "__main__":
    main()