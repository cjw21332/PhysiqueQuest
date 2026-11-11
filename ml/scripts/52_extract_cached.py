#!/usr/bin/env python3
"""R1: Extract keypoints ONCE with multiprocessing, cache to disk."""
import json
import os
import hashlib
import time
import multiprocessing as mp
from multiprocessing import Pool
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple
import numpy as np
from PIL import Image, ImageSequence
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision
from tqdm import tqdm

# ── Constants ──────────────────────────────────────────────────────────────
MODEL_PATH = Path("models/pose_landmarker_lite.task")
assert MODEL_PATH.exists(), f"Model not found: {MODEL_PATH}"

TARGET_FPS = 15
PAD_FACTOR = 1.5
OFFSET = (PAD_FACTOR - 1) / 2  # 0.25
CONF_THRESHOLD = 0.3

DATA_DIR = Path("data")
KEYPOINTS_DIR = DATA_DIR / "keypoints_cached"
KEYPOINTS_DIR.mkdir(parents=True, exist_ok=True)

# ── Worker init (each process creates its own detector) ────────────────────
_detector = None

def _init_worker():
    global _detector
    base_options = mp.tasks.BaseOptions(model_asset_path=str(MODEL_PATH), delegate=mp.tasks.BaseOptions.Delegate.CPU)
    options = vision.PoseLandmarkerOptions(
        base_options=base_options,
        running_mode=vision.RunningMode.IMAGE,
        min_pose_detection_confidence=CONF_THRESHOLD,
        min_pose_presence_confidence=CONF_THRESHOLD,
        min_tracking_confidence=CONF_THRESHOLD,
        num_poses=1,
        output_segmentation_masks=False,
    )
    _detector = vision.PoseLandmarker.create_from_options(options)

def _pad_image(im: Image.Image, factor=PAD_FACTOR) -> Image.Image:
    w, h = im.size
    corner_color = im.getpixel((0, 0))
    canvas = Image.new("RGB", (int(w * factor), int(h * factor)), corner_color)
    offset_x = int(w * (factor - 1) / 2)
    offset_y = int(h * (factor - 1) / 2)
    canvas.paste(im, (offset_x, offset_y))
    return canvas

def _extract_keypoints_from_pil(pil_rgb: Image.Image) -> Optional[np.ndarray]:
    global _detector
    arr = np.ascontiguousarray(np.asarray(pil_rgb, dtype=np.uint8))
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=arr)
    try:
        detection = _detector.detect(mp_image)
    except Exception:
        return None
    if not detection or not detection.pose_landmarks:
        return None
    landmarks = detection.pose_landmarks[0] if isinstance(detection.pose_landmarks, list) else detection.pose_landmarks
    if not landmarks:
        return None
    kps = np.array([[l.x, l.y, l.z, l.visibility] for l in landmarks], dtype=np.float32)
    # Unpad
    kps[:, 0] = kps[:, 0] * PAD_FACTOR - OFFSET
    kps[:, 1] = kps[:, 1] * PAD_FACTOR - OFFSET
    kps[:, 2] = kps[:, 2] * PAD_FACTOR
    # Normalize xyz only, keep visibility in [0,1]
    hip = kps[[23, 24]]; mid_hip = (hip[0] + hip[1]) / 2
    shoulder = kps[[11, 12]]; mid_shoulder = (shoulder[0] + shoulder[1]) / 2
    kps_centered = kps.copy()
    kps_centered[:, :3] -= mid_hip[:3]
    torso_vec = mid_hip[:2] - mid_shoulder[:2]
    torso_len = np.hypot(torso_vec[0], torso_vec[1]) + 1e-6
    kps_centered[:, :3] /= torso_len
    return kps_centered.astype(np.float32)

def _load_gif_frames(gif_path: Path) -> List[Image.Image]:
    frames = []
    with Image.open(gif_path) as gif:
        for f in ImageSequence.Iterator(gif):
            rgba = f.convert("RGBA")
            bg = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
            frames.append(Image.alpha_composite(bg, rgba).convert("RGB"))
    return frames

# ── Process one GIF ────────────────────────────────────────────────────────
def process_gif(args: Tuple[str, Dict]) -> Dict[str, Any]:
    exercise_id, entry = args
    gif_path = Path(entry["file_path"])
    out_path = KEYPOINTS_DIR / f"{exercise_id}.npz"
    
    # Skip if exists
    if out_path.exists():
        return {"exercise_id": exercise_id, "status": "skipped", "frames": 0}
    
    try:
        frames = _load_gif_frames(gif_path)
        if not frames:
            return {"exercise_id": exercise_id, "status": "no_frames", "frames": 0}
        
        # Extract keypoints per frame with timestamps
        timestamps = []
        keypoints = []
        detection_mask = []
        
        for i, frame in enumerate(frames):
            t = i / len(frames) * (len(frames) / 15.0)
            padded = _pad_image(frame)
            kps = _extract_keypoints_from_pil(padded)
            if kps is not None:
                timestamps.append(t)
                keypoints.append(kps)
                detection_mask.append(1)
            else:
                timestamps.append(t)
                keypoints.append(np.zeros((33, 4), dtype=np.float32))
                detection_mask.append(0)
        
        # Resample to 15 FPS
        if len(keypoints) < 5:
            return {"exercise_id": exercise_id, "status": "too_few", "frames": len(frames)}
        
        timestamps = np.array(timestamps)
        kps_array = np.array(keypoints)  # (T, 33, 4)
        
        duration = timestamps[-1] - timestamps[0]
        num_frames = max(1, int(round(duration * TARGET_FPS)))
        t_new = np.linspace(timestamps[0], timestamps[-1], num_frames)
        
        resampled = np.empty((num_frames, 33, 4), dtype=np.float32)
        for joint in range(33):
            for coord in range(4):
                resampled[:, joint, coord] = np.interp(t_new, timestamps, kps_array[:, joint, coord])
        
        # Detection mask resample
        det_resampled = np.interp(t_new, timestamps, np.array(detection_mask, dtype=np.float32))
        det_resampled = (det_resampled > 0.5).astype(np.uint8)
        
        # Save
        np.savez_compressed(out_path,
            landmarks=resampled,
            timestamps=t_new,
            original_fps=15.0,
            detection_mask=det_resampled,
            exercise_id=exercise_id,
            pad_factor=PAD_FACTOR,
            conf_threshold=CONF_THRESHOLD,
        )
        
        return {"exercise_id": exercise_id, "status": "ok", "frames": num_frames, "detected": int(det_resampled.sum())}
    
    except Exception as e:
        return {"exercise_id": exercise_id, "status": f"error: {str(e)[:100]}", "frames": 0}

# ── Main ──────────────────────────────────────────────────────────────────
def main():
    # Load manifest
    with open("data/manifests/combined_manifest.json") as f:
        gif_manifest = json.load(f)
    
    # Prepare args
    args = [(e["exercise_id"], e) for e in gif_manifest]
    print(f"Total GIFs: {len(args)}")
    
    # Count existing
    existing = sum(1 for a in args if (KEYPOINTS_DIR / f"{a[0]}.npz").exists())
    print(f"Already cached: {existing}")
    args = [a for a in args if not (KEYPOINTS_DIR / f"{a[0]}.npz").exists()]
    print(f"To process: {len(args)}")
    
    if not args:
        print("All done.")
        return
    
    # Multiprocessing
    n_workers = max(1, mp.cpu_count() - 2)
    print(f"Starting {n_workers} workers...")
    
    start = time.time()
    results = []
    
    with Pool(n_workers, initializer=_init_worker) as pool:
        for res in tqdm(pool.imap_unordered(process_gif, args), total=len(args), desc="Extracting"):
            results.append(res)
    
    elapsed = time.time() - start
    
    # Summary
    ok = sum(1 for r in results if r["status"] == "ok")
    skipped = sum(1 for r in results if r["status"] == "skipped")
    errors = sum(1 for r in results if r["status"].startswith("error"))
    
    print(f"\n=== EXTRACTION COMPLETE ===")
    print(f"Elapsed: {elapsed:.1f}s ({elapsed/60:.1f} min)")
    print(f"Processed: {ok} ok, {skipped} skipped, {errors} errors")
    print(f"Total cached: {existing + ok}")
    
    # Save results
    with open(KEYPOINTS_DIR / "extraction_results.json", "w") as f:
        json.dump(results, f, indent=2)


if __name__ == "__main__":
    import json
    import multiprocessing as mp
    mp.set_start_method('spawn', force=True)
    main()