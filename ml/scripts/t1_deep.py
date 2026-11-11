#!/usr/bin/env python3
"""T1 Deep: Full extraction on 2 videos without max_frames limit."""
import cv2
import numpy as np
import json
from pathlib import Path
from PIL import Image
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

MODEL_PATHS = {
    "lite": "models/pose_landmarker_lite.task",
    "full": "models/pose_landmarker_full.task",
    "heavy": "models/pose_landmarker_heavy.task",
}
PAD_FACTOR = 1.5
CONF = 0.3
TARGET_FPS = 15
TEST_VIDEOS = [
    "01e83deb_0015_c-curl twist_[13].mp4",
    "04996ace_0016_reverse lunges challenge_[50].mp4",
]
OUTPUT_DIR = Path("reports/t1_deep")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

_vision = mp.tasks.vision

def create_detector(model_path, conf=0.3, mode=_vision.RunningMode.VIDEO):
    base = mp.tasks.BaseOptions(model_asset_path=model_path, delegate=mp.tasks.BaseOptions.Delegate.CPU)
    opts = _vision.PoseLandmarkerOptions(
        base_options=base, running_mode=mode,
        min_pose_detection_confidence=conf, min_pose_presence_confidence=conf, min_tracking_confidence=conf,
        num_poses=1, output_segmentation_masks=False,
    )
    return _vision.PoseLandmarker.create_from_options(opts)

def extract_full(video_path, detector):
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return [], "could not open"
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_step = max(1, int(fps / TARGET_FPS))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    results = []
    frame_idx = 0
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
        print(f"Total frames: {total_f}, FPS: {fps}, Expected @15fps: {exp}")
        
        all_results[vid_name] = {"metadata": {"total_frames": total_f, "fps": fps, "expected_15fps": exp}}
        
        for model_name, model_path in MODEL_PATHS.items():
            if not Path(model_path).exists():
                print(f"  {model_name}: model not found")
                continue
            print(f"  Testing {model_name}...")
            det = create_detector(model_path, CONF)
            kps, err = extract_full(vp, det)
            vis_counts = [int(np.sum(k[:,3] > 0.5)) for _,_,k in kps]
            all_results[vid_name][model_name] = {
                "frames_with_pose": len(kps),
                "detection_rate": len(kps) / exp,
                "avg_visible": float(np.mean(vis_counts)) if vis_counts else 0,
                "min_visible": int(np.min(vis_counts)) if vis_counts else 0,
                "max_visible": int(np.max(vis_counts)) if vis_counts else 0,
            }
            print(f"    Pose frames: {len(kps)}/{exp} = {len(kps)/exp*100:.1f}%, avg vis: {all_results[vid_name][model_name]['avg_visible']:.1f}")
    
    out = OUTPUT_DIR / "t1_deep_results.json"
    with open(out, "w") as f:
        json.dump(all_results, f, indent=2)
    print(f"\nSaved to {out}")

if __name__ == "__main__":
    main()