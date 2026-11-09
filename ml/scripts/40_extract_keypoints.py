#!/usr/bin/env python3
"""Extract MediaPipe Pose keypoints from GIFs and save .npz files.
Uses the same PoseLandmarker model as pose.worker.ts (pose_landmarker_lite.task).
Preprocessing matches debug_pose.py findings: white composite + 1.5x pad + 0.3 confidence.
"""
import json
import os
import re
import hashlib
import time
import traceback
from pathlib import Path
from typing import Optional, Dict, Any, Tuple, List

import numpy as np
import mediapipe as mp
from PIL import Image, ImageSequence
from tqdm import tqdm

# ── Model ──────────────────────────────────────────────────────────────────
MODEL_PATH = Path("models/pose_landmarker_lite.task")
assert MODEL_PATH.exists(), f"Model not found: {MODEL_PATH}"

# Access PoseLandmarker through mp.tasks.vision (attribute access, not import)
_vision = mp.tasks.vision
PoseLandmarker = _vision.PoseLandmarker
PoseLandmarkerOptions = _vision.PoseLandmarkerOptions
RunningMode = _vision.RunningMode

base_options = mp.tasks.BaseOptions(model_asset_path=str(MODEL_PATH), delegate=mp.tasks.BaseOptions.Delegate.CPU)
options = PoseLandmarkerOptions(
    base_options=base_options,
    running_mode=RunningMode.IMAGE,
    min_pose_detection_confidence=0.3,
    min_pose_presence_confidence=0.3,
    min_tracking_confidence=0.3,
    num_poses=1,
    output_segmentation_masks=False,
)
detector = PoseLandmarker.create_from_options(options)

# ── Directories ────────────────────────────────────────────────────────────
DATA_DIR = Path(__file__).parent.parent / "data"
RAW_DIR = DATA_DIR / "raw"
KEYPOINTS_DIR = DATA_DIR / "keypoints"
MANIFESTS_DIR = DATA_DIR / "manifests"

KEYPOINTS_DIR.mkdir(parents=True, exist_ok=True)
MANIFESTS_DIR.mkdir(parents=True, exist_ok=True)
RAW_DIR.mkdir(parents=True, exist_ok=True)

# ── Constants ──────────────────────────────────────────────────────────────
TARGET_FPS = 15               # Resample to 15 FPS
WINDOW_SIZE = 48              # 48 frames @ 15 FPS ≈ 3.2 s
STRIDE = 24                   # 50% overlap
PAD_FACTOR = 1.5              # Canvas padding factor (matches debug_pose.py)
CONF_THRESHOLD = 0.3          # Confidence threshold (matches debug_pose.py findings)

# ── Normalization ──────────────────────────────────────────────────────────
# MediaPipe Pose landmark indices (33 landmarks, as returned by PoseLandmarker)
# Landmark 23 = right hip, landmark 24 = left hip
# Landmark 11 = left shoulder, landmark 12 = right shoulder

def normalize_keypoints(kps_33_4: np.ndarray) -> np.ndarray:
    """
    Normalize 33×4 (x,y,z,visibility) keypoints:
    1. Center on mid-hip (landmark 23 + 24)/2
    2. Scale by torso length (mid-shoulder to mid-hip)
    3. Floor to avoid divide-by-zero
    Returns (33, 4) float32.
    """
    # Landmark 23 = right hip, landmark 24 = left hip
    hip = kps_33_4[[23, 24]]          # [[x,y,z,v], [x,y,z,v]]
    mid_hip = (hip[0] + hip[1]) / 2   # [x,y,z,v]

    # Landmark 11 = left shoulder, landmark 12 = right shoulder
    shoulder = kps_33_4[[11, 12]]     # [[x,y,z,v], [x,y,z,v]]
    mid_shoulder = (shoulder[0] + shoulder[1]) / 2

    kps_centered = kps_33_4 - mid_hip

    torso_vec = mid_hip[:2] - mid_shoulder[:2]   # [dx, dy]
    torso_len = np.hypot(torso_vec[0], torso_vec[1]) + 1e-6

    kps_normalized = kps_centered / torso_len
    return kps_normalized.astype(np.float32)


def unpad_keypoints(kps_33_4: np.ndarray, pad_factor: float = PAD_FACTOR) -> np.ndarray:
    """
    Convert keypoints from padded image coordinates back to original image coordinates.
    MediaPipe returns normalized coordinates [0,1] relative to the input image.
    If input was padded by pad_factor with original centered:
    - Padded image size = (W*pad_factor, H*pad_factor)
    - Original placed at offset (W*(pad_factor-1)/2, H*(pad_factor-1)/2)
    - For pad_factor=1.5: offset = (0.25*W, 0.25*H)
    - x_orig_norm = (x_padded * pad_factor - (pad_factor-1)/2)
    - y_orig_norm = (y_padded * pad_factor - (pad_factor-1)/2)
    - z_orig_norm = z_padded * pad_factor  (z is also scaled by image width)
    """
    offset = (pad_factor - 1.0) / 2.0
    kps_unpadded = kps_33_4.copy()
    kps_unpadded[:, 0] = kps_33_4[:, 0] * pad_factor - offset
    kps_unpadded[:, 1] = kps_33_4[:, 1] * pad_factor - offset
    kps_unpadded[:, 2] = kps_33_4[:, 2] * pad_factor
    return kps_unpadded


def extract_pose_from_pil_image(pil_rgb: Image.Image) -> Optional[np.ndarray]:
    """
    Run MediaPipe Pose on one PIL RGB image.
    Returns (33, 4) normalized keypoints (unpadded + torso-normalized), or None if no pose detected.
    """
    # Convert PIL RGB to contiguous uint8 numpy array
    arr = np.ascontiguousarray(np.asarray(pil_rgb, dtype=np.uint8))
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=arr)

    try:
        detection = detector.detect(mp_image)
    except Exception as e:
        # Log and return None (no swallow)
        return None

    # Check for pose landmarks
    if not detection or not detection.pose_landmarks:
        return None

    # Get landmark list
    landmarks = detection.pose_landmarks[0] if isinstance(detection.pose_landmarks, list) else detection.pose_landmarks
    if not landmarks:
        return None

    # Extract raw keypoints (in padded image coordinates)
    kps = np.array([[l.x, l.y, l.z, l.visibility] for l in landmarks], dtype=np.float32)

    # Un-pad: convert from padded image coords back to original frame coords
    kps_unpadded = unpad_keypoints(kps)

    # Normalize: mid-hip center + torso-length scale
    kps_normalized = normalize_keypoints(kps_unpadded)

    return kps_normalized


def load_gif_frames(gif_path: Path) -> List[Image.Image]:
    """
    Load GIF frames, composite onto white background, convert to RGB.
    Returns list of PIL RGB images.
    """
    frames = []
    try:
        with Image.open(gif_path) as gif:
            for f in ImageSequence.Iterator(gif):
                rgba = f.convert("RGBA")
                bg = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
                rgb_frame = Image.alpha_composite(bg, rgba).convert("RGB")
                frames.append(rgb_frame)
    except Exception as e:
        print(f"  [ERROR] Failed to load GIF {gif_path.name}: {e}")
        traceback.print_exc()
    return frames


def pad_image(im: Image.Image, factor: float = PAD_FACTOR) -> Image.Image:
    """
    Pad image to factor * size, fill with corner pixel color, paste original centered.
    """
    w, h = im.size
    corner_color = im.getpixel((0, 0))
    canvas = Image.new("RGB", (int(w * factor), int(h * factor)), corner_color)
    offset_x = int(w * (factor - 1) / 2)
    offset_y = int(h * (factor - 1) / 2)
    canvas.paste(im, (offset_x, offset_y))
    return canvas


def compute_resampled_keypoints(frames_by_ts: Dict[float, np.ndarray],
                                target_fps: int = TARGET_FPS) -> np.ndarray:
    """
    Given dict of {timestamp_seconds: (33,4) keypoints}, resample to target_fps.
    Returns (N, 33, 4) array where N ≈ target_fps * duration.
    Uses numpy interpolation for clean, artifact-free resampling.
    """
    if not frames_by_ts:
        return np.empty((0, 33, 4), dtype=np.float32)

    timestamps = sorted(frames_by_ts.keys())
    duration = timestamps[-1] - timestamps[0]
    num_frames = max(1, int(round(duration * target_fps)))

    # Create array of keypoint sequences
    kps_array = np.array([frames_by_ts[t] for t in timestamps])

    # Use numpy interpolation
    t_orig = np.array(timestamps)
    t_new = np.linspace(timestamps[0], timestamps[-1], num_frames)

    result = np.empty((num_frames, 33, 4), dtype=np.float32)
    for joint in range(33):
        for coord in range(4):
            result[:, joint, coord] = np.interp(t_new, t_orig, kps_array[:, joint, coord])

    return result


def process_gif_file(gif_path: Path, exercise_id: str = "", pattern: str = "", subject_id: str = "") -> Dict[str, Any]:
    """
    Process a single GIF file.
    Returns manifest dict with extraction metadata.
    """
    manifest = {
        "source": gif_path.name,
        "file_path": str(gif_path),
        "file_sha256": None,
        "duration": None,
        "exercise_id": exercise_id,
        "pattern": pattern,
        "subject_id": subject_id,
        "num_clips": 0,
        "clips": [],
        "num_dropped": 0,
        "keypoint_count": 0,
        "frames_with_pose": 0,
        "total_frames": 0,
        "errors": [],
    }

    # Compute file hash
    sha256 = hashlib.sha256()
    with open(gif_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    manifest["file_sha256"] = sha256.hexdigest()

    # Load GIF frames with PIL (white composite)
    frames = load_gif_frames(gif_path)
    if not frames:
        manifest["error"] = "Could not load any frames"
        manifest["errors"].append("load_gif_frames returned empty")
        return manifest

    manifest["total_frames"] = len(frames)
    duration = len(frames) / TARGET_FPS  # approximate
    manifest["duration"] = duration

    # Collect frames by timestamp - process every frame, sample to target FPS later
    frames_by_ts: Dict[float, np.ndarray] = {}
    for frame_idx, frame_rgb in enumerate(frames):
        # Pad the frame
        padded_frame = pad_image(frame_rgb)

        # Run pose estimation on padded frame
        kps = extract_pose_from_pil_image(padded_frame)
        if kps is not None:
            t = frame_idx / len(frames) * duration
            frames_by_ts[t] = kps
            manifest["frames_with_pose"] += 1

    # Resample keypoints to target FPS
    resampled = compute_resampled_keypoints(frames_by_ts, TARGET_FPS)
    manifest["num_clips"] = len(resampled)
    manifest["keypoint_count"] = len(resampled) * 33  # 33 joints per frame

    # Create clips (windows with stride)
    if len(resampled) >= WINDOW_SIZE:
        for start in range(0, len(resampled) - WINDOW_SIZE + 1, STRIDE):
            window = resampled[start:start + WINDOW_SIZE]
            clip_id = f"{exercise_id or gif_path.stem}_{subject_id or 'auto'}_{start // STRIDE}"

            out_path = KEYPOINTS_DIR / f"{clip_id}.npz"
            np.savez_compressed(out_path, keypoints=window, clip_id=clip_id,
                                exercise_id=exercise_id, pattern=pattern,
                                subject_id=subject_id, source_gif=gif_path.name)

            manifest["clips"].append({
                "clip_id": clip_id,
                "start_frame": start,
                "end_frame": start + WINDOW_SIZE,
                "num_frames": WINDOW_SIZE,
                "keypoints_shape": window.shape,
                "file_path": out_path.name,
            })

    manifest["num_dropped"] = max(0, manifest["total_frames"] - manifest["frames_with_pose"])
    return manifest


def main():
    import sys

    # Resolve source directory
    source_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("data/raw/gifs")
    source_dir = Path(source_dir)

    if not source_dir.exists():
        print(f"Source directory not found: {source_dir}")
        sys.exit(1)

    # Load exercise_ml_map to get pattern for each exerciseId
    ml_map_path = Path(__file__).parent.parent / "data" / "exercise_ml_map.json"
    pattern_map = {}
    if ml_map_path.exists():
        with open(ml_map_path) as f:
            ml_map = json.load(f)
        for exercise_id, entry in ml_map.items():
            pattern_map[exercise_id] = entry.get("movement_pattern", "unknown")

    # Collect all GIF files
    valid_extensions = {".gif"}
    gif_files = sorted([
        f for f in source_dir.iterdir()
        if f.suffix.lower() in valid_extensions and f.is_file() and f.stat().st_size > 0
    ])

    print(f"Found {len(gif_files)} GIF files in {source_dir}")

    # Process each file
    all_manifests = []
    for gif_path in tqdm(gif_files, desc="Processing GIFs"):
        # exerciseId is the filename stem (e.g., "0001" from "0001.gif")
        exercise_id = gif_path.stem
        pattern = pattern_map.get(exercise_id, "unknown")
        subject_id = ""  # GIFs are single demonstrator

        manifest = process_gif_file(gif_path, exercise_id=exercise_id, pattern=pattern, subject_id=subject_id)
        all_manifests.append(manifest)

        # Write manifest per file
        manifest_path = MANIFESTS_DIR / f"{gif_path.stem}_manifest.json"
        with open(manifest_path, "w") as f:
            json.dump(manifest, f, indent=2)

    # Write combined manifest
    combined_manifest_path = MANIFESTS_DIR / "combined_manifest.json"
    with open(combined_manifest_path, "w") as f:
        json.dump(all_manifests, f, indent=2)

    # Print summary
    total_clips = sum(m["num_clips"] for m in all_manifests)
    total_dropped = sum(m["num_dropped"] for m in all_manifests)
    total_keypoints = sum(m["keypoint_count"] for m in all_manifests)
    total_frames_with_pose = sum(m["frames_with_pose"] for m in all_manifests)
    total_frames = sum(m["total_frames"] for m in all_manifests)

    gifs_with_60pct = sum(1 for m in all_manifests if m["total_frames"] > 0 and m["frames_with_pose"] / m["total_frames"] >= 0.6)

    print(f"\n=== EXTRACTION SUMMARY ===")
    print(f"Files processed: {len(all_manifests)}")
    print(f"GIFs with >=60% detected frames: {gifs_with_60pct}/{len(all_manifests)}")
    print(f"Total clips: {total_clips}")
    print(f"Total frames dropped: {total_dropped}")
    print(f"Total keypoints extracted: {total_keypoints}")
    print(f"Frames with pose: {total_frames_with_pose}/{total_frames} ({100*total_frames_with_pose/total_frames:.1f}%)" if total_frames > 0 else "Frames with pose: 0/0 (0%)")
    print(f"Keypoint files saved to: {KEYPOINTS_DIR}")
    print(f"Manifests saved to: {MANIFESTS_DIR}")

    # Per-pattern summary
    from collections import Counter
    pattern_counts = Counter()
    for m in all_manifests:
        pattern_counts[m["pattern"]] += m["num_clips"]

    print(f"\nWindows per pattern:")
    for pattern, count in pattern_counts.most_common():
        print(f"  {pattern}: {count} windows")

    # Output size
    total_size = sum(f.stat().st_size for f in KEYPOINTS_DIR.glob("*.npz"))
    print(f"\nTotal output size: {total_size / (1024*1024):.2f} MB ({total_size} bytes)")


if __name__ == "__main__":
    main()