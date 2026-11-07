"""
Unit Tests for Angle Math, Gap Interpolation, and Cycle Detection

Run with: python -m pytest tests/ -v
"""

import numpy as np
import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from compute_angles import (
    compute_angle_2d,
    compute_trunk_inclination,
    interpolate_gaps,
    smooth_angles,
)
from detect_cycles import (
    compute_robust_range,
    compute_start_angle,
    detect_cycles_on_series,
    CycleInfo,
)
from config import (
    MIN_LANDMARK_VIS,
    MAX_INTERPOLATION_GAP_FRAMES,
    SAVGOL_WINDOW,
    SAVGOL_POLYORDER,
    PERCENTILE_LOW,
    PERCENTILE_HIGH,
    START_END_PERCENTILE,
)


class TestAngleMath:
    """Tests for 2D angle computation."""

    def test_straight_line_180(self):
        """Test angle computation for straight line (180 degrees)."""
        # Points in a straight horizontal line
        p1 = np.array([0.2, 0.5])
        p2 = np.array([0.5, 0.5])  # vertex
        p3 = np.array([0.8, 0.5])
        angle = compute_angle_2d(p1, p2, p3, aspect=1.0)
        assert angle is not None
        assert abs(angle - 180.0) < 1.0

    def test_right_angle_90(self):
        """Test angle computation for right angle (90 degrees)."""
        p1 = np.array([0.5, 0.3])  # above
        p2 = np.array([0.5, 0.5])  # vertex
        p3 = np.array([0.7, 0.5])  # right
        angle = compute_angle_2d(p1, p2, p3, aspect=1.0)
        assert angle is not None
        assert abs(angle - 90.0) < 1.0

    def test_aspect_correction(self):
        """Test that aspect ratio correction works."""
        # Test case where aspect correction changes the angle
        # p1 is left of p2, p3 is above p2
        # With aspect=1: 90 degree angle (horizontal to vertical)
        p1 = np.array([0.3, 0.5])  # left
        p2 = np.array([0.5, 0.5])  # vertex
        p3 = np.array([0.5, 0.3])  # up

        # aspect=1.0: this is a 90 degree angle (horizontal to vertical)
        angle1 = compute_angle_2d(p1, p2, p3, aspect=1.0)
        assert abs(angle1 - 90.0) < 1.0

        # Test with diagonal points where aspect matters
        # p1 at (0.4, 0.4), p2 at (0.5, 0.5), p3 at (0.5, 0.6)
        # Vector p2->p1: (-0.1, -0.1), p2->p3: (0, 0.1)
        # Without aspect: angle between (-1,-1) and (0,1) = 135 deg
        # With aspect=2: p2->p1: (-0.2, -0.1), p2->p3: (0, 0.1), angle changes
        p1 = np.array([0.4, 0.4])  # up-left diagonal
        p2 = np.array([0.5, 0.5])  # vertex
        p3 = np.array([0.5, 0.6])  # down
        angle1 = compute_angle_2d(p1, p2, p3, aspect=1.0)
        angle2 = compute_angle_2d(p1, p2, p3, aspect=2.0)
        assert angle1 is not None
        assert angle2 is not None
        assert abs(angle1 - angle2) > 5.0  # aspect changes the angle

    def test_invalid_points(self):
        """Test handling of degenerate cases."""
        # Coincident points
        p1 = np.array([0.5, 0.5])
        p2 = np.array([0.5, 0.5])
        p3 = np.array([0.5, 0.5])
        angle = compute_angle_2d(p1, p2, p3, aspect=1.0)
        assert angle is None

        # Two coincident points (p1 == p2)
        p1 = np.array([0.5, 0.5])
        p2 = np.array([0.5, 0.5])
        p3 = np.array([0.6, 0.5])
        angle = compute_angle_2d(p1, p2, p3, aspect=1.0)
        assert angle is None

        # Very short segments (below threshold of 1e-6)
        p1 = np.array([0.5, 0.5])
        p2 = np.array([0.5000001, 0.5])  # distance ~1e-7
        p3 = np.array([0.5, 0.5000001])  # distance ~1e-7
        angle = compute_angle_2d(p1, p2, p3, aspect=1.0)
        assert angle is None


class TestTrunkInclination:
    """Tests for trunk inclination computation."""

    def test_vertical_trunk(self):
        """Test trunk inclination for vertical pose."""
        landmarks = [{"visibility": 1.0, "x": 0.5, "y": 0.5} for _ in range(33)]
        # Shoulders at y=0.3, hips at y=0.7 (vertical)
        landmarks[11] = {"visibility": 1.0, "x": 0.4, "y": 0.3}
        landmarks[12] = {"visibility": 1.0, "x": 0.6, "y": 0.3}
        landmarks[23] = {"visibility": 1.0, "x": 0.4, "y": 0.7}
        landmarks[24] = {"visibility": 1.0, "x": 0.6, "y": 0.7}

        angle = compute_trunk_inclination(landmarks, aspect=1.0)
        assert angle is not None
        assert abs(angle) < 5.0  # Nearly vertical

    def test_leaning_trunk(self):
        """Test trunk inclination for leaning pose."""
        landmarks = [{"visibility": 1.0, "x": 0.5, "y": 0.5} for _ in range(33)]
        # Shoulders shifted right
        landmarks[11] = {"visibility": 1.0, "x": 0.5, "y": 0.3}
        landmarks[12] = {"visibility": 1.0, "x": 0.7, "y": 0.3}
        landmarks[23] = {"visibility": 1.0, "x": 0.4, "y": 0.7}
        landmarks[24] = {"visibility": 1.0, "x": 0.6, "y": 0.7}

        angle = compute_trunk_inclination(landmarks, aspect=1.0)
        assert angle is not None
        # Should be leaning right (positive angle)
        assert angle > 10.0


class TestGapInterpolation:
    """Tests for gap interpolation."""

    def test_interpolate_small_gap(self):
        """Test interpolation of small NaN gap."""
        angles = np.array([10.0, 20.0, np.nan, np.nan, 50.0, 60.0])
        result = interpolate_gaps(angles, max_gap=3)
        assert not np.isnan(result[2])
        assert not np.isnan(result[3])
        # Linear interpolation between 20 and 50
        assert abs(result[2] - 30.0) < 1.0
        assert abs(result[3] - 40.0) < 1.0

    def test_no_interpolate_large_gap(self):
        """Test that large gaps are not interpolated."""
        angles = np.array([10.0, 20.0, np.nan, np.nan, np.nan, np.nan, 60.0])
        result = interpolate_gaps(angles, max_gap=3)
        assert np.isnan(result[2])
        assert np.isnan(result[3])
        assert np.isnan(result[4])
        assert np.isnan(result[5])

    def test_edge_gaps_not_interpolated(self):
        """Test that gaps at edges are not interpolated."""
        angles = np.array([np.nan, np.nan, 20.0, 30.0, 40.0])
        result = interpolate_gaps(angles, max_gap=3)
        assert np.isnan(result[0])
        assert np.isnan(result[1])

        angles = np.array([20.0, 30.0, 40.0, np.nan, np.nan])
        result = interpolate_gaps(angles, max_gap=3)
        assert np.isnan(result[3])
        assert np.isnan(result[4])

    def test_no_nan_no_change(self):
        """Test that arrays without NaN are unchanged."""
        angles = np.array([10.0, 20.0, 30.0, 40.0])
        result = interpolate_gaps(angles, max_gap=3)
        np.testing.assert_array_equal(result, angles)


class TestSmoothing:
    """Tests for angle smoothing."""

    def test_savgol_smoothing(self):
        """Test Savitzky-Golay smoothing on clean data."""
        # Noisy sine wave
        x = np.linspace(0, 4 * np.pi, 50)
        clean = 90 + 30 * np.sin(x)
        noise = np.random.normal(0, 2, len(x))
        noisy = clean + noise

        smoothed = smooth_angles(noisy, window=7, polyorder=2)

        # Smoothed should be closer to clean than noisy
        noisy_error = np.mean((noisy - clean) ** 2)
        smooth_error = np.mean((smoothed - clean) ** 2)
        assert smooth_error < noisy_error

    def test_smoothing_preserves_nan(self):
        """Test that NaN positions are preserved."""
        angles = np.array([10.0, np.nan, 30.0, np.nan, 50.0])
        smoothed = smooth_angles(angles, window=3, polyorder=1)
        assert np.isnan(smoothed[1])
        assert np.isnan(smoothed[3])
        assert not np.isnan(smoothed[0])
        assert not np.isnan(smoothed[2])
        assert not np.isnan(smoothed[4])

    def test_short_segment_fallback(self):
        """Test fallback to moving average for short segments."""
        # Only 3 valid points - less than SAVGOL_WINDOW
        angles = np.array([np.nan, 10.0, 20.0, 30.0, np.nan])
        smoothed = smooth_angles(angles, window=7, polyorder=2)
        assert not np.isnan(smoothed[1])
        assert not np.isnan(smoothed[2])
        assert not np.isnan(smoothed[3])


class TestRobustRange:
    """Tests for robust range computation."""

    def test_normal_range(self):
        """Test range computation on normal data."""
        angles = np.array([80, 85, 90, 95, 100, 105, 110, 115, 120, 125], dtype=float)
        valid = np.ones_like(angles, dtype=bool)
        range_deg = compute_robust_range(angles, valid)
        # 95th - 5th percentile ≈ 125 - 80 = 45
        assert abs(range_deg - 45.0) < 5.0

    def test_with_outliers(self):
        """Test that percentiles are robust to outliers."""
        # With 20 points, 5th/95th percentiles are more stable
        angles = np.array([90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 
                          100, 101, 102, 103, 104, 105, 106, 107, 108, 200], dtype=float)
        valid = np.ones_like(angles, dtype=bool)
        range_deg = compute_robust_range(angles, valid)
        # 5th percentile ~90.95, 95th percentile ~107.05, range ~16
        # The outlier (200) should not affect 95th percentile much
        assert range_deg < 30.0

    def test_with_nan(self):
        """Test with some invalid values."""
        angles = np.array([90, np.nan, 100, 110, np.nan, 120], dtype=float)
        valid = ~np.isnan(angles)
        range_deg = compute_robust_range(angles, valid)
        assert range_deg > 0.0


class TestStartAngle:
    """Tests for start angle computation."""

    def test_start_angle_midpoint(self):
        """Test start angle from first/last 10%."""
        angles = np.linspace(90, 150, 100)  # Straight to bent
        valid = np.ones(100, dtype=bool)

        start = compute_start_angle(angles, valid)
        # Should be near 90 (first 10%) and 150 (last 10%) median ≈ 120
        # Wait - start is median of first AND last 10%
        # First 10: ~90-96, Last 10: ~144-150, median ≈ 120
        assert 110 < start < 130

    def test_constant_angle(self):
        """Test start angle for constant angle."""
        angles = np.full(100, 90.0)
        valid = np.ones(100, dtype=bool)
        start = compute_start_angle(angles, valid)
        assert abs(start - 90.0) < 0.1


class TestCycleDetection:
    """Tests for cycle detection on synthetic data."""

    def test_sinusoid_one_cycle(self):
        """Test detection on single sine wave cycle."""
        # One full cycle starting at maximum: 1.5 periods of sine
        # max -> min -> max = one rep
        x = np.linspace(0, 3 * np.pi, 75)  # 1.5 cycles
        angles = 90 + 30 * np.sin(x)  # Range 60-120, starts at 90 (going up), then max at 120, min at 60, max at 120
        # Actually, sin(0)=0, so starts at 90. Let's use -cos to start at max
        angles = 90 + 30 * (-np.cos(x))  # Starts at 60 (min), goes to 120 (max), back to 60 (min)
        # Better: use phase shift to start at max
        angles = 120 + 30 * np.cos(x)  # Starts at 150, goes to 90, back to 150 - wait that's not right
        # Let's just do: max at 120, min at 60, max at 120
        # cos(0) = 1, so 120 - 30*1 = 90... not 120
        # Let's use: 90 + 30*cos(x) - starts at 120, goes to 60, back to 120
        angles = 90 + 30 * np.cos(x)  # cos(0)=1 -> 120, cos(π)=-1 -> 60, cos(2π)=1 -> 120
        valid = np.ones_like(angles, dtype=bool)
        timestamps = np.arange(len(angles)) * 100.0  # 100ms per frame

        from detect_cycles import AngleSeries
        series = AngleSeries(
            joint_name="test_knee",
            angles=angles,
            valid_mask=valid,
            timestamps=timestamps,
            frame_indices=np.arange(len(angles)),
        )

        cycles = detect_cycles_on_series(series)
        assert len(cycles) >= 1
        cycle = cycles[0]
        # Cycle: start=120 (max), peak=60 (min), end=120 (max)
        assert cycle.direction == "decreasing"
        assert abs(cycle.range_deg - 60.0) < 10.0

    def test_sinusoid_multiple_cycles(self):
        """Test detection on multiple cycles."""
        # 3 full cycles: max -> min -> max -> min -> max -> min -> max = 3 reps
        x = np.linspace(0, 6 * np.pi, 150)  # 3 cycles of cos = 3 reps
        angles = 90 + 30 * np.cos(x)  # Starts at 120, each cos cycle = 1 rep
        valid = np.ones_like(angles, dtype=bool)
        timestamps = np.arange(len(angles)) * 100.0

        from detect_cycles import AngleSeries
        series = AngleSeries(
            joint_name="test_knee",
            angles=angles,
            valid_mask=valid,
            timestamps=timestamps,
            frame_indices=np.arange(len(angles)),
        )

        cycles = detect_cycles_on_series(series)
        assert len(cycles) == 3

    def test_squat_like_pattern(self):
        """Test detection on squat-like pattern (slow down, fast up)."""
        # Squat: slow descent, pause, fast ascent
        n = 80
        angles = np.zeros(n)
        # Down phase (frames 0-25): 150 -> 90
        angles[:25] = np.linspace(150, 90, 25)
        # Pause at bottom (frames 25-30): 90 - flat, no peak
        angles[25:30] = 90
        # Up phase (frames 30-45): 90 -> 150
        angles[30:45] = np.linspace(90, 150, 15)
        # Hold at top (frames 45-55): 150 - flat
        angles[45:55] = 150
        # Second rep: down (55-70): 150 -> 90
        angles[55:70] = np.linspace(150, 90, 15)
        # Pause (70-75): 90
        angles[70:75] = 90
        # Up (75-80): 90 -> 150
        angles[75:] = np.linspace(90, 150, 5)

        valid = np.ones(n, dtype=bool)
        timestamps = np.arange(n) * 100.0

        from detect_cycles import AngleSeries
        series = AngleSeries(
            joint_name="test_knee",
            angles=angles,
            valid_mask=valid,
            timestamps=timestamps,
            frame_indices=np.arange(n),
        )

        cycles = detect_cycles_on_series(series)
        assert len(cycles) >= 1
        cycle = cycles[0]
        # Squat: start=150 (max), peak=90 (min), end=150 (max)
        assert cycle.direction == "decreasing"
        assert abs(cycle.start_angle - 150) < 10
        assert abs(cycle.peak_angle - 90) < 10
        assert abs(cycle.range_deg - 60) < 10

    def test_no_cycle_insufficient_range(self):
        """Test no cycles detected when range too small."""
        angles = np.linspace(90, 95, 50)  # Only 5 degree range
        valid = np.ones_like(angles, dtype=bool)
        timestamps = np.arange(len(angles)) * 100.0

        from detect_cycles import AngleSeries
        series = AngleSeries(
            joint_name="test",
            angles=angles,
            valid_mask=valid,
            timestamps=timestamps,
            frame_indices=np.arange(len(angles)),
        )

        cycles = detect_cycles_on_series(series)
        assert len(cycles) == 0

    def test_no_cycle_too_few_points(self):
        """Test no cycles with insufficient data."""
        angles = np.array([90.0, 100.0, 90.0])
        valid = np.ones_like(angles, dtype=bool)
        timestamps = np.arange(len(angles)) * 100.0

        from detect_cycles import AngleSeries
        series = AngleSeries(
            joint_name="test",
            angles=angles,
            valid_mask=valid,
            timestamps=timestamps,
            frame_indices=np.arange(len(angles)),
        )

        cycles = detect_cycles_on_series(series)
        assert len(cycles) == 0


class TestParityWithPython:
    """Tests to ensure TS implementation matches Python (for Phase C)."""

    def test_angle_math_parity(self):
        """Reference values for TypeScript implementation."""
        # These are the exact values the TS genericRepCounter should produce
        test_cases = [
            # (p1, p2, p3, aspect, expected_angle)
            ((0.2, 0.5), (0.5, 0.5), (0.8, 0.5), 1.0, 180.0),
            ((0.5, 0.3), (0.5, 0.5), (0.7, 0.5), 1.0, 90.0),
            ((0.3, 0.5), (0.5, 0.5), (0.5, 0.3), 1.0, 90.0),
            ((0.3, 0.5), (0.5, 0.5), (0.5, 0.3), 2.0, None),  # Different with aspect
        ]

        for p1, p2, p3, aspect, expected in test_cases:
            angle = compute_angle_2d(np.array(p1), np.array(p2), np.array(p3), aspect)
            if expected is not None:
                assert angle is not None
                assert abs(angle - expected) < 1.0, f"Expected {expected}, got {angle}"
            else:
                assert angle is not None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])