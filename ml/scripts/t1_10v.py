#!/usr/bin/env python3
"""T1: 10 videos with fresh detector each."""
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
MAX_POSE = 300

TEST_VIDEOS = [
    "01e83deb_0015_c-curl twist_[13].mp4",
    "01e83deb_0055_knee to chest_[17].mp4",
    "01e83deb_0136_bent scissor_[36].mp4",
    "04996ace_0016_reverse lunges challenge_[50].mp4",
    "0a9a588e_0009_leg lift_[14].mp4",
    "14c2c3f4_0045_drop squats_[40].mp4",
    "14c2c3f4_0447_push up toe tap_[14-13-15].mp4",
    "17e2d98f_0241_slow sq_[6].mp4",
    "36f0d07e_0300_bicep curls_[24].mp4",
    "5e3a8d78_0514_push up (on knees)_[12].mp4",
]
OUT = Path("reports/t1_10")
OUT.mkdir(parents=True, exist_ok=True)

_vision = mp.tasks.vision

def new_det():
    base = mp.tasks.BaseOptions(model_asset_path=MODEL_PATH, delegate=mp.tasks.BaseOptions.Delegate.CPU)
    opts = _vision.PoseLandmarkerOptions(base_options=base, running_mode=_vision.RunningMode.VIDEO,
        min_pose_detection_confidence=CONF, min_pose_presence_confidence=CONF, min_tracking_confidence=CONF,
        num_poses=1, output_segmentation_masks=False)
    return _vision.PoseLandmarker.create_from_options(opts)

def extract(vp, det):
    cap = cv2.VideoCapture(str(vp))
    if not cap.isOpened(): return [], "open fail"
    fps = cap.get(cv2.CAP_PROP_FPS)
    step = max(1, int(fps / TARGET_FPS))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    res = []; fi = 0; pc = 0
    while True:
        ret, f = cap.read()
        if not ret: break
        if fi % step == 0:
            pil = Image.fromarray(cv2.cvtColor(f, cv2.COLOR_BGR2RGB))
            w, h = pil.size
            c = pil.getpixel((0,0))
            can = Image.new("RGB", (int(w*PAD_FACTOR), int(h*PAD_FACTOR)), c)
            can.paste(pil, (int(w*0.25), int(h*0.25)))
            arr = np.ascontiguousarray(np.array(can, dtype=np.uint8))
            mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=arr)
            ts = int(fi / fps * 1000)
            try:
                dr = det.detect_for_video(mp_img, ts)
                if dr and dr.pose_landmarks:
                    lms = dr.pose_landmarks[0] if isinstance(dr.pose_landmarks, list) else dr.pose_landmarks
                    if lms:
                        res.append((fi, ts, np.array([[l.x,l.y,l.z,l.visibility] for l in lms], dtype=np.float32)))
                        pc += 1
                        if pc >= MAX_POSE: break
            except: pass
        fi += 1
    cap.release()
    return res, None

def main():
    R = {}
    for i, vn in enumerate(TEST_VIDEOS):
        vp = Path("data/raw/real_video/pushupbench") / vn
        if not vp.exists():
            R[vn] = {"error": "missing"}
            continue
        cap = cv2.VideoCapture(str(vp))
        tf = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        exp = tf // max(1, int(fps / TARGET_FPS))
        cap.release()
        print(f"[{i+1}/10] {vn}: {tf}fr @{fps:.0f}fps {w}x{h} exp={exp}")
        kps, _ = extract(vp, new_det())
        vc = [int(np.sum(k[:,3]>0.5)) for _,_,k in kps]
        R[vn] = {"meta": {"tf": tf, "fps": fps, "w": w, "h": h, "exp": exp},
                 "pose": len(kps), "rate": len(kps)/exp if exp else 0,
                 "avg_vis": float(np.mean(vc)) if vc else 0}
        print(f"  -> {len(kps)}/{exp} = {R[vn]['rate']*100:.1f}%, avg_vis={R[vn]['avg_vis']:.1f}")
    with open(OUT/"t1_10_results.json", "w") as f:
        json.dump(R, f, indent=2)
    print("\n=== SUMMARY ===")
    print(f"{'Video':<50} {'TF':>5} {'FPS':>4} {'Exp':>5} {'Pose':>5} {'Rate':>6} {'AvgVis':>6}")
    for vn, r in R.items():
        if "error" in r: print(f"{vn:<50} ERROR"); continue
        m = r["meta"]; print(f"{vn:<50} {m['tf']:>5} {m['fps']:>4.0f} {m['exp']:>5} {r['pose']:>5} {r['rate']*100:>5.1f}% {r['avg_vis']:>6.1f}")

if __name__ == "__main__":
    main()