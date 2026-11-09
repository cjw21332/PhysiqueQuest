#!/usr/bin/env python3
"""Download PushUpBench videos and extract keypoints."""
import os
import json
import hashlib
from pathlib import Path
import numpy as np
from PIL import Image
import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision
from huggingface_hub import hf_hub_download
from tqdm import tqdm

# ── Model ──────────────────────────────────────────────────────────────────
MODEL_PATH = Path("models/pose_landmarker_lite.task")
assert MODEL_PATH.exists(), f"Model not found: {MODEL_PATH}"

_vision = mp.tasks.vision
PoseLandmarker = _vision.PoseLandmarker
PoseLandmarkerOptions = _vision.PoseLandmarkerOptions
RunningMode = _vision.RunningMode

base_options = mp.tasks.BaseOptions(model_asset_path=str(MODEL_PATH), delegate=mp.tasks.BaseOptions.Delegate.CPU)
options = PoseLandmarkerOptions(
    base_options=base_options,
    running_mode=RunningMode.VIDEO,
    min_pose_detection_confidence=0.3,
    min_pose_presence_confidence=0.3,
    min_tracking_confidence=0.3,
    num_poses=1,
    output_segmentation_masks=False,
)
detector = PoseLandmarker.create_from_options(options)

# ── Directories ────────────────────────────────────────────────────────────
DATA_DIR = Path("data")
RAW_DIR = DATA_DIR / "raw" / "real_video"
KEYPOINTS_DIR = DATA_DIR / "keypoints_real"
MANIFESTS_DIR = DATA_DIR / "manifests"

RAW_DIR.mkdir(parents=True, exist_ok=True)
KEYPOINTS_DIR.mkdir(parents=True, exist_ok=True)
MANIFESTS_DIR.mkdir(parents=True, exist_ok=True)

# ── Constants ──────────────────────────────────────────────────────────────
TARGET_FPS = 15
WINDOW_SIZE = 48
STRIDE = 24
PAD_FACTOR = 1.5
CONF_THRESHOLD = 0.3

def normalize_keypoints(kps_33_4: np.ndarray) -> np.ndarray:
    hip = kps_33_4[[23, 24]]
    mid_hip = (hip[0] + hip[1]) / 2
    shoulder = kps_33_4[[11, 12]]
    mid_shoulder = (shoulder[0] + shoulder[1]) / 2
    kps_centered = kps_33_4 - mid_hip
    torso_vec = mid_hip[:2] - mid_shoulder[:2]
    torso_len = np.hypot(torso_vec[0], torso_vec[1]) + 1e-6
    kps_normalized = kps_centered / torso_len
    return kps_normalized.astype(np.float32)

def unpad_keypoints(kps_33_4: np.ndarray, pad_factor: float = PAD_FACTOR) -> np.ndarray:
    offset = (pad_factor - 1.0) / 2.0
    kps_unpadded = kps_33_4.copy()
    kps_unpadded[:, 0] = kps_33_4[:, 0] * pad_factor - offset
    kps_unpadded[:, 1] = kps_33_4[:, 1] * pad_factor - offset
    kps_unpadded[:, 2] = kps_33_4[:, 2] * pad_factor
    return kps_unpadded

def pad_image(im: Image.Image, factor: float = PAD_FACTOR) -> Image.Image:
    w, h = im.size
    corner_color = im.getpixel((0, 0))
    canvas = Image.new("RGB", (int(w * factor), int(h * factor)), corner_color)
    offset_x = int(w * (factor - 1) / 2)
    offset_y = int(h * (factor - 1) / 2)
    canvas.paste(im, (offset_x, offset_y))
    return canvas

def extract_keypoints_from_video(video_path: Path, max_frames: int = None) -> list:
    """Extract keypoints from video file, return list of (timestamp, keypoints)."""
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return []
    
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps if fps > 0 else 0
    
    # Sample frames at target FPS
    frame_step = max(1, int(fps / TARGET_FPS))
    
    results = []
    frame_idx = 0
    extracted = 0
    
    while True:
        ret, frame_bgr = cap.read()
        if not ret:
            break
        
        if frame_idx % frame_step == 0:
            # Convert BGR to RGB
            frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(frame_rgb)
            
            # Pad
            padded = pad_image(pil_img)
            
            # Run MediaPipe
            arr = np.ascontiguousarray(np.asarray(padded, dtype=np.uint8))
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=arr)
            
            try:
                detection = detector.detect_for_video(mp_image, int(frame_idx / fps * 1000))
                if detection and detection.pose_landmarks:
                    landmarks = detection.pose_landmarks[0] if isinstance(detection.pose_landmarks, list) else detection.pose_landmarks
                    if landmarks:
                        kps = np.array([[l.x, l.y, l.z, l.visibility] for l in landmarks], dtype=np.float32)
                        kps_unpadded = unpad_keypoints(kps)
                        kps_norm = normalize_keypoints(kps_unpadded)
                        timestamp = frame_idx / fps
                        results.append((timestamp, kps_norm))
                        extracted += 1
            except Exception as e:
                pass
        
        frame_idx += 1
        if max_frames and extracted >= max_frames:
            break
    
    cap.release()
    return results

def compute_resampled_keypoints(frames_by_ts: list, target_fps: int = TARGET_FPS) -> np.ndarray:
    """frames_by_ts: list of (timestamp, (33,4) keypoints)"""
    if not frames_by_ts:
        return np.empty((0, 33, 4), dtype=np.float32)
    
    timestamps = [t for t, _ in frames_by_ts]
    kps_array = np.array([k for _, k in frames_by_ts])
    
    duration = timestamps[-1] - timestamps[0]
    num_frames = max(1, int(round(duration * target_fps)))
    
    t_orig = np.array(timestamps)
    t_new = np.linspace(timestamps[0], timestamps[-1], num_frames)
    
    result = np.empty((num_frames, 33, 4), dtype=np.float32)
    for joint in range(33):
        for coord in range(4):
            result[:, joint, coord] = np.interp(t_new, t_orig, kps_array[:, joint, coord])
    
    return result

def main():
    # Get list of PushUpBench videos
    from huggingface_hub import list_repo_files
    files = list_repo_files('anonymousatom/pushupbench', repo_type='dataset')
    mp4_files = [f for f in files if f.endswith('.mp4')]
    print(f"Found {len(mp4_files)} MP4 files in PushUpBench")
    
    # Download and process each video
    all_manifests = []
    
    for mp4_file in tqdm(mp4_files, desc="Processing PushUpBench videos"):
        try:
            # Download video
            local_path = hf_hub_download(
                repo_id='anonymousatom/pushupbench',
                filename=mp4_file,
                repo_type='dataset',
                local_dir=RAW_DIR / "pushupbench",
                local_dir_use_symlinks=False
            )
            video_path = Path(local_path)
            
            # Extract keypoints
            frames_kps = extract_keypoints_from_video(video_path)
            
            # Resample
            resampled = compute_resampled_keypoints(frames_kps)
            
            # Create manifest
            manifest = {
                "source": mp4_file,
                "dataset": "pushupbench",
                "file_path": str(video_path),
                "duration": frames_kps[-1][0] - frames_kps[0][0] if frames_kps else 0,
                "exercise_name": mp4_file.split('_')[-1].replace('.mp4', ''),
                "num_frames_extracted": len(frames_kps),
                "num_frames_resampled": len(resampled),
                "num_clips": 0,
                "clips": [],
                "frames_with_pose": len(frames_kps),
            }
            
            # Create windows
            if len(resampled) >= WINDOW_SIZE:
                for start in range(0, len(resampled) - WINDOW_SIZE + 1, STRIDE):
                    window = resampled[start:start + WINDOW_SIZE]
                    clip_id = f"pushupbench_{mp4_file.replace('.mp4', '')}_{start // STRIDE}"
                    
                    out_path = KEYPOINTS_DIR / f"{clip_id}.npz"
                    np.savez_compressed(out_path, keypoints=window, clip_id=clip_id,
                                        source=mp4_file, dataset="pushupbench")
                    
                    manifest["clips"].append({
                        "clip_id": clip_id,
                        "start_frame": start,
                        "end_frame": start + WINDOW_SIZE,
                        "num_frames": WINDOW_SIZE,
                        "keypoints_shape": window.shape,
                        "file_path": out_path.name,
                    })
                manifest["num_clips"] = len(manifest["clips"])
            
            all_manifests.append(manifest)
            
        except Exception as e:
            print(f"Error processing {mp4_file}: {e}")
            all_manifests.append({
                "source": mp4_file,
                "dataset": "pushupbench",
                "error": str(e)
            })
    
    # Save combined manifest
    manifest_path = MANIFESTS_DIR / "pushupbench_manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(all_manifests, f, indent=2)
    
    # Summary
    total_clips = sum(m.get("num_clips", 0) for m in all_manifests)
    total_frames = sum(m.get("num_frames_resampled", 0) for m in all_manifests)
    total_with_pose = sum(m.get("frames_with_pose", 0) for m in all_manifests)
    
    print(f"\n=== PUSHUPBENCH EXTRACTION SUMMARY ===")
    print(f"Videos processed: {len(all_manifests)}")
    print(f"Total frames with pose: {total_with_pose}")
    print(f"Total resampled frames: {total_frames}")
    print(f"Total clips (windows): {total_clips}")
    print(f"Manifest saved to: {manifest_path}")
    print(f"Keypoints saved to: {KEYPOINTS_DIR}")

if __name__ == "__main__":
    main()