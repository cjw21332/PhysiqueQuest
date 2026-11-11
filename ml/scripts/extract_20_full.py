#!/usr/bin/env python3
"""Extract full keypoints for 20 PushUpBench videos with GT reps."""
import cv2
import numpy as np
from pathlib import Path
from PIL import Image
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

MODEL = "models/pose_landmarker_lite.task"
PAD = 1.5
TARGET_FPS = 15

_vision = mp.tasks.vision
base = mp.tasks.BaseOptions(model_asset_path=MODEL, delegate=mp.tasks.BaseOptions.Delegate.CPU)
opts = _vision.PoseLandmarkerOptions(base_options=base, running_mode=_vision.RunningMode.VIDEO,
    min_pose_detection_confidence=0.3, min_pose_presence_confidence=0.3, min_tracking_confidence=0.3,
    num_poses=1, output_segmentation_masks=False)
det = _vision.PoseLandmarker.create_from_options(opts)

# 20 videos with ground-truth reps (single-set)
VIDEOS = [
    "01e83deb_0015_c-curl twist_[13].mp4",
    "01e83deb_0055_knee to chest_[17].mp4",
    "01e83deb_0136_bent scissor_[36].mp4",
    "04996ace_0016_reverse lunges challenge_[50].mp4",
    "0a9a588e_0009_leg lift_[14].mp4",
    "14c2c3f4_0045_drop squats_[40].mp4",
    "14c2c3f4_0447_push up toe tap_[14-13-15].mp4",
    "14c2c3f4_0751_side plank raises(right side)_[51].mp4",
    "17e2d98f_0241_slow sq_[6].mp4",
    "17e2d98f_0341_step jacks_[30].mp4",
    "1e6a72cd_0814_wall push_[10].mp4",
    "1e6a72cd_0914_kickback(l)_[17].mp4",
    "36f0d07e_0300_bicep curls_[24].mp4",
    "36f0d07e_0716_box push-ups_[11].mp4",
    "5e3a8d78_0514_push up (on knees)_[12].mp4",
    "60093019_0019_donkey kicks_[50].mp4",
    "01e83deb_0216_toe taps_[16].mp4",
    "0a9a588e_0109_donkey twist_[8].mp4",
    "1e6a72cd_0114_1 leg bridge(r)_[14].mp4",
    "3977a2e05bacbfc8e3be9a48162bc169_1012_alternating side crunch_[14].mp4",
]

OUT_DIR = Path("data/keypoints_full")
OUT_DIR.mkdir(parents=True, exist_ok=True)

def extract(vp):
    cap = cv2.VideoCapture(str(vp))
    if not cap.isOpened():
        return None
    fps = cap.get(cv2.CAP_PROP_FPS)
    step = max(1, int(fps / TARGET_FPS))
    res = []
    fi = 0
    while True:
        ret, f = cap.read()
        if not ret:
            break
        if fi % step == 0:
            pil = Image.fromarray(cv2.cvtColor(f, cv2.COLOR_BGR2RGB))
            w, h = pil.size
            c = pil.getpixel((0,0))
            can = Image.new("RGB", (int(w*PAD), int(h*PAD)), c)
            can.paste(pil, (int(w*0.25), int(h*0.25)))
            arr = np.ascontiguousarray(np.array(can, dtype=np.uint8))
            mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=arr)
            ts = int(fi / fps * 1000)
            try:
                dr = det.detect_for_video(mp_img, ts)
                if dr and dr.pose_landmarks:
                    lms = dr.pose_landmarks[0] if isinstance(dr.pose_landmarks, list) else dr.pose_landmarks
                    if lms:
                        res.append(np.array([[l.x,l.y,l.z,l.visibility] for l in lms], dtype=np.float32))
            except:
                pass
        fi += 1
    cap.release()
    return np.array(res) if res else None

for vn in VIDEOS:
    vp = Path("data/raw/real_video/pushupbench") / vn
    if not vp.exists():
        print(f"MISSING: {vn}")
        continue
    out_path = OUT_DIR / f"{vn.replace('.mp4', '')}.npz"
    if out_path.exists():
        print(f"SKIP (exists): {vn}")
        continue
    print(f"Extracting {vn}...")
    kps = extract(vp)
    if kps is not None:
        np.savez_compressed(out_path, keypoints=kps)
        print(f"  Saved {kps.shape[0]} frames")
    else:
        print("  FAILED")