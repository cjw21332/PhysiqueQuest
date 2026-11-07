"""
Cycle Detection & Primary Joint Analysis

Detects repetition cycles, determines primary joint(s), side mode, and reference range.
"""

import numpy as np
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple, Literal
from dataclasses import dataclass, field, asdict
from scipy.signal import find_peaks
from tqdm import tqdm

from config import (
    LANDMARK_CACHE_DIR,
    MIN_RANGE_DEG,
    PEAK_PROMINENCE_FRACTION,
    MIN_CYCLES,
    PERCENTILE_LOW,
    PERCENTILE_HIGH,
    START_END_PERCENTILE,
    STABLE_MAX_RANGE,
    MIN_TOLERANCE,
    MIN_VALID_FRACTION,
    MIN_PERSON_DETECTED_FRACTION,
    SIDE_JOINTS,
    VIEW_HINT_SHOULDER_WIDTH_TORSO_RATIO,
    LOGGER,
)
from compute_angles import ExerciseAngles, AngleSeries, load_angles


@dataclass
class CycleInfo:
    start_idx: int
    peak_idx: int
    end_idx: int
    start_angle: float
    peak_angle: float
    end_angle: float
    direction: Literal["increasing", "decreasing"]
    range_deg: float


@dataclass
class StabilityConstraint:
    joint_name: str
    mean_angle: float
    tolerance: float
    valid_fraction: float


@dataclass
class SideAnalysis:
    side: Literal["left", "right"]
    primary_joint: Optional[str]
    primary_range: float
    cycles: List[CycleInfo]
    valid_fraction: float
    all_ranges: Dict[str, float]


@dataclass
class ExerciseAnalysis:
    exerciseId: str
    status: str
    reason_codes: List[str]
    primary_joints: List[str]
    side_mode: Literal["bilateral", "unilateral", "alternating", "unknown"]
    start_angles: Dict[str, float]
    peak_angles: Dict[str, float]
    directions: Dict[str, Literal["increasing", "decreasing"]]
    reference_ranges: Dict[str, float]
    stability_constraints: List[StabilityConstraint]
    view_hint: Literal["front", "side", "unknown"]
    cycle_count: int
    valid_fraction: float
    side_analyses: Dict[str, SideAnalysis]
    person_detected_fraction: float
    fps: float
    frame_count: int
    duration_ms: float
    thresholds_used: Dict[str, Any]
    generator_version: str
    generated_at: str


def compute_robust_range(angles: np.ndarray, valid_mask: np.ndarray) -> float:
    """Compute 95th - 5th percentile range for valid angles."""
    valid_angles = angles[valid_mask]
    if len(valid_angles) < 2:
        return 0.0
    # Use interpolation='linear' for consistent behavior
    low = np.percentile(valid_angles, PERCENTILE_LOW, interpolation='linear')
    high = np.percentile(valid_angles, PERCENTILE_HIGH, interpolation='linear')
    return float(high - low)


def compute_start_angle(angles: np.ndarray, valid_mask: np.ndarray) -> float:
    """Compute start angle as median of first and last 10% of valid frames."""
    valid_indices = np.where(valid_mask)[0]
    if len(valid_indices) == 0:
        return 0.0

    n = len(valid_indices)
    percentile_count = max(1, int(n * START_END_PERCENTILE / 100))

    start_indices = valid_indices[:percentile_count]
    end_indices = valid_indices[-percentile_count:]

    all_indices = np.concatenate([start_indices, end_indices])
    return float(np.median(angles[all_indices]))


def detect_cycles_on_series(series: AngleSeries) -> List[CycleInfo]:
    """Detect repetition cycles on a single angle series."""
    angles = series.angles
    valid = series.valid_mask
    timestamps = series.timestamps

    # Only work with valid data
    valid_angles = angles[valid]
    valid_timestamps = timestamps[valid]
    valid_indices = np.where(valid)[0]

    if len(valid_angles) < 3:
        return []

    # Compute range for prominence threshold
    range_deg = compute_robust_range(angles, valid)
    if range_deg < MIN_RANGE_DEG:
        return []

    prominence = range_deg * PEAK_PROMINENCE_FRACTION

    # Find peaks (both maxima and minima) using scipy
    peaks_max, _ = find_peaks(valid_angles, prominence=prominence, distance=5)
    peaks_min, _ = find_peaks(-valid_angles, prominence=prominence, distance=5)

    # Add boundary extrema if they exist (find_peaks doesn't detect boundary peaks)
    # Check if first valid point is a local extremum
    if len(valid_angles) > 2:
        # First point: compare with next few points
        first_angle = valid_angles[0]
        next_angles = valid_angles[1:min(4, len(valid_angles))]
        if np.all(first_angle >= next_angles):  # Local maximum at start
            if 0 not in peaks_max:
                peaks_max = np.insert(peaks_max, 0, 0)
        elif np.all(first_angle <= next_angles):  # Local minimum at start
            if 0 not in peaks_min:
                peaks_min = np.insert(peaks_min, 0, 0)

        # Last point: compare with previous few points
        last_angle = valid_angles[-1]
        prev_angles = valid_angles[max(0, len(valid_angles)-3):-1]
        if np.all(last_angle >= prev_angles):  # Local maximum at end
            if len(valid_angles) - 1 not in peaks_max:
                peaks_max = np.append(peaks_max, len(valid_angles) - 1)
        elif np.all(last_angle <= prev_angles):  # Local minimum at end
            if len(valid_angles) - 1 not in peaks_min:
                peaks_min = np.append(peaks_min, len(valid_angles) - 1)

    # Combine and sort all extrema
    all_peaks = []
    for idx in peaks_max:
        all_peaks.append((valid_indices[idx], valid_angles[idx], "max"))
    for idx in peaks_min:
        all_peaks.append((valid_indices[idx], valid_angles[idx], "min"))

    all_peaks.sort(key=lambda x: x[0])

    # Need at least 3 extrema for 1 cycle (start -> extreme -> return)
    if len(all_peaks) < 3:
        return []

    # Group into cycles: look for patterns of max-min-max or min-max-min
    cycles = []
    i = 0
    while i + 2 < len(all_peaks):
        start_idx, start_angle, start_type = all_peaks[i]
        peak_idx, peak_angle, peak_type = all_peaks[i + 1]
        end_idx, end_angle, end_type = all_peaks[i + 2]

        # Check if this forms a valid cycle
        # Pattern 1: max -> min -> max (start at max, go down to min, return to max)
        # Pattern 2: min -> max -> min (start at min, go up to max, return to min)
        
        if start_type == peak_type or peak_type == end_type:
            # Not alternating, skip one and try again
            i += 1
            continue

        # Determine direction: start -> peak
        if peak_angle > start_angle:
            direction = "increasing"
        else:
            direction = "decreasing"

        # Verify it returns toward start (allow some tolerance)
        range_cycle = abs(peak_angle - start_angle)
        if range_cycle < MIN_RANGE_DEG:
            i += 1
            continue

        # Check return: end should be closer to start than peak
        if direction == "increasing":
            if not (end_angle < peak_angle and end_angle > start_angle - range_cycle * 0.3):
                i += 1
                continue
        else:
            if not (end_angle > peak_angle and end_angle < start_angle + range_cycle * 0.3):
                i += 1
                continue

        cycles.append(CycleInfo(
            start_idx=int(start_idx),
            peak_idx=int(peak_idx),
            end_idx=int(end_idx),
            start_angle=float(start_angle),
            peak_angle=float(peak_angle),
            end_angle=float(end_angle),
            direction=direction,
            range_deg=float(range_cycle),
        ))
        i += 2  # Move to next potential cycle (overlap by 1)

    return cycles


def analyze_side(
    angles: ExerciseAngles,
    side: Literal["left", "right"],
) -> SideAnalysis:
    """Analyze one side for primary joint and cycles."""
    side_joints = SIDE_JOINTS[side]
    available_joints = [j for j in side_joints if j in angles.angle_series]

    if not available_joints:
        return SideAnalysis(
            side=side,
            primary_joint=None,
            primary_range=0.0,
            cycles=[],
            valid_fraction=0.0,
            all_ranges={},
        )

    # Compute range and valid fraction for each joint
    joint_ranges = {}
    joint_valid_fractions = {}
    joint_cycles = {}

    for joint in available_joints:
        series = angles.angle_series[joint]
        range_deg = compute_robust_range(series.angles, series.valid_mask)
        valid_frac = np.mean(series.valid_mask) if len(series.valid_mask) > 0 else 0.0

        joint_ranges[joint] = range_deg
        joint_valid_fractions[joint] = valid_frac

        # Detect cycles if valid fraction is sufficient
        if valid_frac >= MIN_VALID_FRACTION:
            cycles = detect_cycles_on_series(series)
            joint_cycles[joint] = cycles
        else:
            joint_cycles[joint] = []

    # Select primary joint: largest range among those with sufficient valid fraction
    eligible = [
        (j, joint_ranges[j]) for j in available_joints
        if joint_valid_fractions[j] >= MIN_VALID_FRACTION and joint_cycles[j]
    ]

    if not eligible:
        # No joint with cycles; pick one with best valid fraction
        best = max(available_joints, key=lambda j: joint_valid_fractions[j])
        return SideAnalysis(
            side=side,
            primary_joint=best,
            primary_range=joint_ranges[best],
            cycles=[],
            valid_fraction=joint_valid_fractions[best],
            all_ranges=joint_ranges,
        )

    primary = max(eligible, key=lambda x: x[1])[0]

    return SideAnalysis(
        side=side,
        primary_joint=primary,
        primary_range=joint_ranges[primary],
        cycles=joint_cycles[primary],
        valid_fraction=joint_valid_fractions[primary],
        all_ranges=joint_ranges,
    )


def detect_side_mode(
    left: SideAnalysis,
    right: SideAnalysis,
) -> Tuple[Literal["bilateral", "unilateral", "alternating", "unknown"], List[str]]:
    """Determine if movement is bilateral, unilateral, or alternating."""
    left_has = left.primary_joint is not None and len(left.cycles) > 0
    right_has = right.primary_joint is not None and len(right.cycles) > 0

    if not left_has and not right_has:
        return "unknown", []

    if left_has and right_has:
        # Check if they move together (similar cycle timing)
        left_cycles = left.cycles
        right_cycles = right.cycles

        if len(left_cycles) == len(right_cycles) and len(left_cycles) > 0:
            # Compare cycle timing
            timing_diff = np.mean([
                abs(l.start_idx - r.start_idx) for l, r in zip(left_cycles, right_cycles)
            ])
            if timing_diff < 5:  # frames
                return "bilateral", [left.primary_joint, right.primary_joint]

        # Check if they alternate (one moves, then the other)
        # This is more complex; for now, if both have cycles but not synchronized
        return "alternating", [left.primary_joint, right.primary_joint]

    if left_has:
        return "unilateral", [left.primary_joint]
    if right_has:
        return "unilateral", [right.primary_joint]

    return "unknown", []


def find_stability_constraints(
    angles: ExerciseAngles,
    primary_joints: List[str],
) -> List[StabilityConstraint]:
    """Find joints that should remain stable during the movement."""
    constraints = []

    for joint_name, series in angles.angle_series.items():
        if joint_name in primary_joints:
            continue  # Don't constrain the moving joint

        range_deg = compute_robust_range(series.angles, series.valid_mask)
        valid_frac = np.mean(series.valid_mask) if len(series.valid_mask) > 0 else 0.0

        if range_deg < STABLE_MAX_RANGE and valid_frac >= MIN_VALID_FRACTION:
            mean_angle = float(np.mean(series.angles[series.valid_mask]))
            # Tolerance is max of MIN_TOLERANCE and 2x the observed range
            tolerance = max(MIN_TOLERANCE, range_deg * 2)
            constraints.append(StabilityConstraint(
                joint_name=joint_name,
                mean_angle=mean_angle,
                tolerance=float(tolerance),
                valid_fraction=float(valid_frac),
            ))

    # Also check trunk inclination
    if angles.trunk_inclination:
        trunk_range = compute_robust_range(
            angles.trunk_inclination.angles,
            angles.trunk_inclination.valid_mask,
        )
        trunk_valid = np.mean(angles.trunk_inclination.valid_mask)
        if trunk_range < STABLE_MAX_RANGE and trunk_valid >= MIN_VALID_FRACTION:
            mean_angle = float(np.mean(
                angles.trunk_inclination.angles[angles.trunk_inclination.valid_mask]
            ))
            tolerance = max(MIN_TOLERANCE, trunk_range * 2)
            constraints.append(StabilityConstraint(
                joint_name="trunk_inclination",
                mean_angle=mean_angle,
                tolerance=float(tolerance),
                valid_fraction=float(trunk_valid),
            ))

    return constraints


def estimate_view_hint(angles: ExerciseAngles) -> Literal["front", "side", "unknown"]:
    """Heuristic: estimate camera view from shoulder width vs torso length."""
    # Need shoulder and hip landmarks - not available in angle series
    # This is a placeholder; would need landmark data
    # For now, return unknown
    return "unknown"


def analyze_exercise(exercise_id: str) -> ExerciseAnalysis:
    """Full analysis for one exercise."""
    angles = load_angles(exercise_id)
    if angles is None:
        return ExerciseAnalysis(
            exerciseId=exercise_id,
            status="manual_only",
            reason_codes=["PROCESSING_ERROR"],
            primary_joints=[],
            side_mode="unknown",
            start_angles={},
            peak_angles={},
            directions={},
            reference_ranges={},
            stability_constraints=[],
            view_hint="unknown",
            cycle_count=0,
            valid_fraction=0.0,
            side_analyses={},
            person_detected_fraction=0.0,
            fps=0.0,
            frame_count=0,
            duration_ms=0.0,
            thresholds_used={},
            generator_version="1.0.0",
            generated_at="",
        )

    # Analyze each side
    left = analyze_side(angles, "left")
    right = analyze_side(angles, "right")

    # Determine side mode and primary joints
    side_mode, primary_joints = detect_side_mode(left, right)

    # Collect all cycles
    all_cycles = left.cycles + right.cycles
    cycle_count = len(all_cycles)

    # Determine status and reason codes
    reason_codes = []
    status = "manual_only"

    # Check person detection
    if angles.person_detected_fraction < MIN_PERSON_DETECTED_FRACTION:
        reason_codes.append("NO_PERSON")

    # Check primary joint validity
    primary_valid = False
    for joint in primary_joints:
        series = angles.angle_series.get(joint)
        if series and np.mean(series.valid_mask) >= MIN_VALID_FRACTION:
            primary_valid = True
            break

    if not primary_valid and primary_joints:
        reason_codes.append("LOW_VISIBILITY")

    # Check cycles
    if cycle_count < MIN_CYCLES:
        reason_codes.append("NO_CYCLE")

    # Check range
    max_range = 0.0
    for joint in primary_joints:
        series = angles.angle_series.get(joint)
        if series:
            r = compute_robust_range(series.angles, series.valid_mask)
            max_range = max(max_range, r)

    if max_range < MIN_RANGE_DEG:
        reason_codes.append("LOW_RANGE")

    # Check for isometric/stretch (very low movement overall)
    all_ranges = [compute_robust_range(s.angles, s.valid_mask) for s in angles.angle_series.values()]
    if all_ranges and max(all_ranges) < 15.0:
        reason_codes.append("ISOMETRIC_OR_STRETCH")

    # Equipment occlusion suspicion (from catalog - would need catalog data)
    # Placeholder - not implemented here

    # Determine final status
    if not reason_codes:
        if primary_valid and cycle_count >= MIN_CYCLES and max_range >= MIN_RANGE_DEG:
            # Check if we have good stability constraints
            constraints = find_stability_constraints(angles, primary_joints)
            if constraints:
                status = "rep_trackable"
            else:
                status = "rep_trackable_limited"
        else:
            status = "rep_trackable_limited"
    elif "NO_PERSON" in reason_codes or "DOWNLOAD_FAILED" in reason_codes:
        status = "manual_only"
    else:
        status = "manual_only"

    # Compute start/peak/direction/reference for each primary joint
    start_angles = {}
    peak_angles = {}
    directions = {}
    reference_ranges = {}

    for joint in primary_joints:
        series = angles.angle_series.get(joint)
        if series is None:
            continue

        # Use first cycle for reference values
        cycles = detect_cycles_on_series(series)
        if cycles:
            cycle = cycles[0]
            start_angles[joint] = cycle.start_angle
            peak_angles[joint] = cycle.peak_angle
            directions[joint] = cycle.direction
            reference_ranges[joint] = cycle.range_deg
        else:
            # Fallback to overall statistics
            start_angles[joint] = compute_start_angle(series.angles, series.valid_mask)
            valid_angles = series.angles[series.valid_mask]
            if len(valid_angles) > 0:
                peak_angles[joint] = float(np.max(valid_angles) if directions.get(joint, "increasing") == "increasing" else np.min(valid_angles))
                reference_ranges[joint] = float(np.max(valid_angles) - np.min(valid_angles))
            else:
                peak_angles[joint] = 0.0
                reference_ranges[joint] = 0.0

    # Stability constraints
    constraints = find_stability_constraints(angles, primary_joints)

    # View hint
    view_hint = estimate_view_hint(angles)

    # Valid fraction (average of primary joints)
    valid_fractions = []
    for joint in primary_joints:
        series = angles.angle_series.get(joint)
        if series:
            valid_fractions.append(np.mean(series.valid_mask))
    valid_fraction = float(np.mean(valid_fractions)) if valid_fractions else 0.0

    # Thresholds used
    thresholds_used = {
        "MIN_LANDMARK_VIS": 0.5,
        "MIN_VALID_FRACTION": MIN_VALID_FRACTION,
        "MIN_RANGE_DEG": MIN_RANGE_DEG,
        "PEAK_PROMINENCE_FRACTION": PEAK_PROMINENCE_FRACTION,
        "MIN_CYCLES": MIN_CYCLES,
        "STABLE_MAX_RANGE": STABLE_MAX_RANGE,
        "MIN_TOLERANCE": MIN_TOLERANCE,
        "MIN_PERSON_DETECTED_FRACTION": MIN_PERSON_DETECTED_FRACTION,
        "MAX_INTERPOLATION_GAP_FRAMES": MAX_INTERPOLATION_GAP_FRAMES,
        "SAVGOL_WINDOW": SAVGOL_WINDOW,
    }

    from datetime import datetime
    return ExerciseAnalysis(
        exerciseId=exercise_id,
        status=status,
        reason_codes=reason_codes,
        primary_joints=primary_joints,
        side_mode=side_mode,
        start_angles=start_angles,
        peak_angles=peak_angles,
        directions=directions,
        reference_ranges=reference_ranges,
        stability_constraints=constraints,
        view_hint=view_hint,
        cycle_count=cycle_count,
        valid_fraction=valid_fraction,
        side_analyses={"left": left, "right": right},
        person_detected_fraction=angles.person_detected_fraction,
        fps=angles.fps,
        frame_count=angles.frame_count,
        duration_ms=angles.duration_ms,
        thresholds_used=thresholds_used,
        generator_version="1.0.0",
        generated_at=datetime.utcnow().isoformat() + "Z",
    )


def main():
    """Analyze all exercises with angle data."""
    LOGGER.info("Starting cycle detection pipeline")

    # Find all angle files
    npz_files = list(LANDMARK_CACHE_DIR.glob("*_angles.npz"))
    LOGGER.info(f"Found {len(npz_files)} angle files")

    analyses = []
    for npz_path in tqdm(npz_files, desc="Analyzing cycles"):
        exercise_id = npz_path.stem.replace("_angles", "")
        try:
            analysis = analyze_exercise(exercise_id)
            analyses.append(analysis)
        except Exception as e:
            LOGGER.error(f"Failed to analyze {exercise_id}: {e}")

    LOGGER.info(f"Cycle analysis complete: {len(analyses)} exercises")

    # Save all analyses
    output_path = LANDMARK_CACHE_DIR.parent / "output" / "generated_configs.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Convert to serializable format
    serializable = []
    for a in analyses:
        d = asdict(a)
        # Convert SideAnalysis objects
        d["side_analyses"] = {k: asdict(v) for k, v in a.side_analyses.items()}
        # Convert StabilityConstraint objects
        d["stability_constraints"] = [asdict(c) for c in a.stability_constraints]
        # Convert CycleInfo objects
        for side in d["side_analyses"].values():
            side["cycles"] = [asdict(c) for c in side["cycles"]]
        serializable.append(d)

    with open(output_path, "w") as f:
        json.dump(serializable, f, indent=2)

    LOGGER.info(f"Saved generated configs to {output_path}")


if __name__ == "__main__":
    import json
    from datetime import datetime
    main()