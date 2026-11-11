#!/usr/bin/env python3
"""Quick diagnostic: test pose detection on standing PushUpBench videos."""
import cv2
import numpy as np
import json
from pathlib import Path
from PIL import Image
import mediapipe as mp
from mediapipe.tasks.python import vision

MODEL_PATH = Path("models/pose_landmarker_lite.task")
base_options = mp.tasks.BaseOptions(model_asset_path=str(MODEL_PATH), delegate=mp.tasks.BaseOptions.Delegate.CPU)
options = vision.PoseLandmarkerOptions(
    base_options=base_options,
    running_mode=vision.RunningMode.VIDEO,
    min_pose_detection_confidence=0.15,
    min_pose_presence_confidence=0.15,
    min_tracking_confidence=0.15,
    num_poses=1,
)
detector = vision.PoseLandmarker.create_from_options(options)

PAD_FACTOR = 1.5

def pad_image(im):
    w, h = im.size
    corner_color = im.getpixel((0, 0))
    canvas = Image.new("RGB", (int(w * PAD_FACTOR), int(h * PAD_FACTOR)), corner_color)
    offset_x = int(w * (PAD_FACTOR - 1) / 2)
    offset_y = int(h * (PAD_FACTOR - 1) / 2)
    canvas.paste(im, (offset_x, offset_y))
    return canvas

with open("configs/pushupbench_taxonomy_mapping.json") as f:
    mapping = json.load(f)

STANDING_PATTERNS = ["squat", "horizontal_push", "cardio_dynamic", "lateral_raise"]

video_dir = Path("data/raw/real_video/pushupbench")
results = []

for v in sorted(video_dir.glob("*.mp4")):
    parts = v.name.replace(".mp4", "").split("_", 2)
    if len(parts) >= 3:
        ex_name = parts[2].rsplit("_", 1)[0].lower()
        pattern = mapping.get(ex_name, "unknown")
        if pattern not in STANDING_PATTERNS:
            continue

        cap = cv2.VideoCapture(str(v))
        fps = cap.get(cv2.CAP_PROP_FPS)
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        frame_step = max(1, int(fps / 15))
        poses_found = 0
        frames_read = 0
        total_sampled = 0

        while True:
            ret, frame_bgr = cap.read()
            if not ret:
                break
            frames_read += 1
            if frames_read % frame_step != 0:
                continue
            total_sampled += 1

            frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(frame_rgb)
            padded = pad_image(pil_img)

            arr = np.ascontiguousarray(np.asarray(padded, dtype=np.uint8))
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=arr)
            ts = int(frames_read / fps * 1000)

            try:
                det = detector.detect_for_video(mp_image, ts)
                if det and det.pose_landmarks:
                    poses_found += 1
            except Exception:
                pass

        cap.release()
        ok = "OK" if poses_found > 3 else "FAIL"
        results.append((v.name, pattern, total, total_sampled, poses_found, ok))
        print("{}: {} | {}f sampled {} | {} poses {}".format(v.name, pattern, total_sampled, total, poses_found, ok))

# Summary
print("\n=== SUMMARY ===")
ok_count = sum(1 for r in results if r[5] == "OK")
fail_count = sum(1 for r in results if r[5] == "FAIL")
print("Total standing videos: {}".format(len(results)))
print("Pose detection OK (>3 poses): {}".format(ok_count))
print("Pose detection FAIL: {}".format(fail_count))

if fail_count > 0:
    print("\nFailed videos:")
    for name, pat, total, sampled, poses, status in results:
        if status == "FAIL":
            print("  {}: {} ({} poses of {} samples)".format(name, pat, poses, sampled))