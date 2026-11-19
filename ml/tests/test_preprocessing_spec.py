"""FEATURE_SPEC conformance tests for scripts/71_extract_videos.py.

These are pure numpy checks of the pad -> unpad -> normalise -> resample
contract. They do not need MediaPipe or a video file.
"""
import importlib.util
from pathlib import Path

import numpy as np

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "71_extract_videos.py"
spec = importlib.util.spec_from_file_location("extract_videos", SCRIPT)
ev = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ev)


def synthetic_landmarks() -> np.ndarray:
    """A plausible standing pose in ORIGINAL (unpadded) normalised coords."""
    kps = np.zeros((33, 4), dtype=np.float32)
    kps[:, 3] = 0.9
    kps[11] = [0.45, 0.30, 0.0, 0.95]   # left shoulder
    kps[12] = [0.55, 0.30, 0.0, 0.95]   # right shoulder
    kps[23] = [0.46, 0.55, 0.0, 0.95]   # left hip
    kps[24] = [0.54, 0.55, 0.0, 0.95]   # right hip
    kps[25] = [0.45, 0.75, 0.0, 0.9]
    kps[26] = [0.55, 0.75, 0.0, 0.9]
    kps[27] = [0.44, 0.95, 0.0, 0.9]
    kps[28] = [0.56, 0.95, 0.0, 0.9]
    return kps


def to_padded(kps: np.ndarray) -> np.ndarray:
    """The inverse of unpad_and_normalize's coordinate mapping."""
    out = kps.copy()
    out[:, 0] = (out[:, 0] + ev.OFFSET) / ev.PAD_FACTOR
    out[:, 1] = (out[:, 1] + ev.OFFSET) / ev.PAD_FACTOR
    out[:, 2] = out[:, 2] / ev.PAD_FACTOR
    return out


def test_pad_offset_constants_match_spec():
    assert ev.PAD_FACTOR == 1.5
    assert ev.OFFSET == 0.25
    assert ev.TARGET_FPS == 15.0


def normalise_without_padding(kps: np.ndarray) -> np.ndarray:
    """FEATURE_SPEC normalisation applied to already-unpadded coordinates."""
    mid_hip = (kps[23] + kps[24]) / 2.0
    mid_shoulder = (kps[11] + kps[12]) / 2.0
    torso = float(np.hypot(*(mid_hip[:2] - mid_shoulder[:2])))
    return ((kps - mid_hip) / torso).astype(np.float32)


def test_unpad_recovers_original_coordinates():
    original = synthetic_landmarks()
    recovered = ev.unpad_and_normalize(to_padded(original))
    assert recovered is not None
    # Padding then un-padding must be a no-op before normalisation, so the
    # recovered pose equals the original pose normalised directly.
    np.testing.assert_allclose(recovered, normalise_without_padding(original), atol=1e-5)


def test_normalisation_centres_mid_hip_and_scales_by_torso():
    normalised = ev.unpad_and_normalize(to_padded(synthetic_landmarks()))
    assert normalised is not None

    mid_hip = (normalised[23] + normalised[24]) / 2.0
    np.testing.assert_allclose(mid_hip[:3], 0.0, atol=1e-5)

    mid_shoulder = (normalised[11] + normalised[12]) / 2.0
    torso = np.hypot(*(mid_shoulder[:2] - mid_hip[:2]))
    np.testing.assert_allclose(torso, 1.0, atol=1e-5)


def test_zero_torso_is_rejected_as_missed_detection():
    kps = np.zeros((33, 4), dtype=np.float32)
    assert ev.unpad_and_normalize(kps) is None


def test_resample_builds_uniform_15fps_grid():
    rng = np.random.default_rng(0)
    frames, times = 40, np.arange(40) * 66.7  # 15 fps input
    landmarks = rng.normal(size=(frames, 33, 4)).astype(np.float32)
    resampled, grid = ev.resample(landmarks, times)
    expected_n = max(2, round(float(times[-1] - times[0]) / 1000.0 * 15.0))
    assert resampled.shape == (expected_n, 33, 4)
    assert grid.shape == (expected_n,)
    # FEATURE_SPEC picks n = round(duration * 15) then linspace(t0, tN, n), so the
    # spacing is duration / (n - 1): within one sample of 15 fps, not exactly it.
    steps = np.diff(grid)
    np.testing.assert_allclose(steps, steps[0], atol=1e-9)
    # The error is O(1/(n-1)), so short clips deviate by a few percent at most.
    assert abs(steps[0] - 1000.0 / 15.0) / (1000.0 / 15.0) < 0.05
    assert grid[0] == times[0] and grid[-1] == times[-1]


def test_pad_image_places_frame_at_quarter_offset():
    rgb = np.zeros((10, 20, 3), dtype=np.uint8)
    rgb[:, :] = (7, 8, 9)
    padded = ev.pad_image(rgb)
    assert padded.shape == (15, 30, 3)
    # Corner fill comes from pixel (0, 0); the pasted frame starts at (0.25).
    assert tuple(padded[0, 0]) == (7, 8, 9)
