#!/usr/bin/env python3
"""T1 Lite only: Fast extraction with frame limit."""
import cv2
import numpy as np
import json
from pathlib import Path
from PIL import Image
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

MODEL_PATH = "models/pose_landmarker_lite.task"
PAD_FACTOR = 1.5
CONF = 0.3
TARGET_FPS = 15
MAX_POSE_FRAMES = 200  # Stop after this many pose detections
TEST_VIDEOS = [
    "01e83deb_0015_c-curl twist_[13].mp4",
    "04996ace_0016_reverse lunges challenge_[50].mp4",
    "14c2c3f4_0045_drop squats_[40].mp4",
    "36f0d07e_0300_bicep curls_[24].mp4",
    "5e3a8d78_0514_push up (on knees)_[12].mp4",
]
OUTPUT_DIR = Path("reports/t1_lite")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

_vision = mp.tasks.vision
base_options = mp.tasks.BaseOptions(model_asset_path=MODEL_PATH, delegate=mp.tasks.BaseOptions.Delegate.CPU)
options = _vision.PoseLandmarkerOptions(
    base_options=base_options, running_mode=_vision.RunningMode.VIDEO,
    min_pose_detection_confidence=CONF, min_pose_presence_confidence=CONF, min_tracking_confidence=CONF,
    num_poses=1, output_segmentation_masks=False,
)
detector = _vision.PoseLandmarker.create_from_options(options)

def extract_limited(video_path):
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return [], "could not open"
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_step = max(1, int(fps / TARGET_FPS))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    results = []
    frame_idx = 0
    pose_count = 0
    while True:
        ret, frame_bgr = cap.read()
        if not ret:
            break
        if frame_idx % frame_step == 0:
            frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
            pil = Image.fromarray(frame_rgb)
            w, h = pil.size
            corner = pil.getpixel((0, 0))
            canvas = Image.new("RGB", (int(w*PAD_FACTOR), int(h*PAD_FACTOR)), corner)
            ox, oy = int(w*(PAD_FACTOR-1)/2), int(h*(PAD_FACTOR-1)/2)
            canvas.paste(pil, (ox, oy))
            arr = np.ascontiguousarray(np.array(canvas, dtype=np.uint8))
            mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=arr)
            ts = int(frame_idx / fps * 1000)
            try:
                det_result = detector.detect_for_video(mp_img, ts)
                if det_result and det_result.pose_landmarks:
                    lms = det_result.pose_landmarks[0] if isinstance(det_result.pose_landmarks, list) else det_result.pose_landmarks
                    if lms:
                        kps = np.array([[l.x, l.y, l.z, l.visibility] for l in lms], dtype=np.float32)
                        results.append((frame_idx, ts, kps))
                        pose_count += 1
                        if pose_count >= MAX_POSE_FRAMES:
                            break
            except Exception as e:
                pass
        frame_idx += 1
    cap.release()
    return results, None

def main():
    all_results = {}
    for vid_name in TEST_VIDEOS:
        vp = Path("data/raw/real_video/pushupbench") / vid_name
        if not vp.exists():
            print(f"MISSING: {vid_name}")
            continue
        
        print(f"\n=== {vid_name} ===")
        cap = cv2.VideoCapture(str(vp))
        total_f = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        exp = total_f // max(1, int(fps / TARGET_FPS))
        cap.release()
        print(f"Total: {total_f} frames, FPS: {fps:.1f}, Expected @15fps: {exp}")
        
        kps, err = extract_limited(vp)
        vis_counts = [int(np.sum(k[:,3] > 0.5)) for _,_,k in kps]
        
        all_results[vid_name] = {
            "metadata": {"total_frames": total_f, "fps": fps, "expected_15fps": exp},
            "frames_with_pose": len(kps),
            "detection_rate": len(kps) / exp,
            "avg_visible": float(np.mean(vis_counts)) if vis_counts else 0,
            "min_visible": int(np.min(vis_counts)) if vis_counts else 0,
            "max_visible": int(np.max(vis_counts)) if vis_counts else 0,
            "visible_distribution": vis_counts[:50],
        }
        print(f"  Pose frames: {len(kps)}/{exp} = {len(kps)/exp*100:.1f}%, avg vis: {all_results[vid_name]['avg_visible']:.1f}")
    
    out = OUTPUT_DIR / "t1_lite_results.json"
    with open(out, "w") as f:
        json.dump(all_results, f, indent=2)
    print(f"\nSaved to {out}")

if __name__ == "__main__":
    main()