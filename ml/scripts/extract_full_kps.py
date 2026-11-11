#!/usr/bin/env python3
"""Extract full video keypoints for rep counting."""
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

def extract_full(vp):
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

# Extract for the 2 videos with GT reps
VIDEOS = [
    "data/raw/real_video/pushupbench/01e83deb_0015_c-curl twist_[13].mp4",
    "data/raw/real_video/pushupbench/04996ace_0016_reverse lunges challenge_[50].mp4",
]

OUT_DIR = Path("data/keypoints_full")
OUT_DIR.mkdir(parents=True, exist_ok=True)

for vp in VIDEOS:
    vn = Path(vp).stem
    print(f"Extracting {vn}...")
    kps = extract_full(vp)
    if kps is not None:
        np.savez_compressed(OUT_DIR / f"{vn}.npz", keypoints=kps)
        print(f"  Saved {kps.shape[0]} frames")
    else:
        print("  FAILED")