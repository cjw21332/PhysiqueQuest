#!/usr/bin/env python3
"""T1 Quick: Real-video extraction bug hunt - 5 videos, core tests only."""
import cv2
import numpy as np
import json
import os
from pathlib import Path
from PIL import Image
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision
import sys

MODEL_PATH = Path("models/pose_landmarker_lite.task")
assert MODEL_PATH.exists()

PAD_FACTOR = 1.5
CONF_THRESHOLD = 0.3
TARGET_FPS = 15
TEST_VIDEOS = [
    "01e83deb_0015_c-curl twist_[13].mp4",
    "04996ace_0016_reverse lunges challenge_[50].mp4",
    "14c2c3f4_0045_drop squats_[40].mp4",
    "14c2c3f4_0447_push up toe tap_[14-13-15].mp4",
    "36f0d07e_0300_bicep curls_[24].mp4",
]
OUTPUT_DIR = Path("reports/t1_quick")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

_vision = mp.tasks.vision
PoseLandmarker = _vision.PoseLandmarker
PoseLandmarkerOptions = _vision.PoseLandmarkerOptions
RunningMode = _vision.RunningMode

base_options = mp.tasks.BaseOptions(model_asset_path=str(MODEL_PATH), delegate=mp.tasks.BaseOptions.Delegate.CPU)

def create_detector(conf=0.3, mode=RunningMode.VIDEO):
    options = PoseLandmarkerOptions(
        base_options=base_options,
        running_mode=mode,
        min_pose_detection_confidence=conf,
        min_pose_presence_confidence=conf,
        min_tracking_confidence=conf,
        num_poses=1,
        output_segmentation_masks=False,
    )
    return PoseLandmarker.create_from_options(options)

def get_video_metadata(video_path):
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return None
    meta = {
        "frame_count": int(cap.get(cv2.CAP_PROP_FRAME_COUNT)),
        "fps": cap.get(cv2.CAP_PROP_FPS),
        "width": int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
        "height": int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
    }
    cap.release()
    return meta

def save_frames(video_path, output_dir, num_frames=3):
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return []
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    indices = [0, total // 2, total - 1] if total >= 3 else list(range(min(total, num_frames)))
    saved = []
    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ret, frame = cap.read()
        if ret:
            out_path = output_dir / f"{video_path.stem}_frame{idx}.png"
            cv2.imwrite(str(out_path), frame)
            saved.append({"frame_idx": idx, "path": str(out_path), "shape": frame.shape})
    cap.release()
    return saved

def extract_video_mode(video_path, detector, conf=0.3, max_frames=100):
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return [], "could not open"
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_step = max(1, int(fps / TARGET_FPS))
    results = []
    frame_idx = 0
    extracted = 0
    while True:
        ret, frame_bgr = cap.read()
        if not ret:
            break
        if frame_idx % frame_step == 0:
            frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(frame_rgb)
            w, h = pil_img.size
            corner_color = pil_img.getpixel((0, 0))
            canvas = Image.new("RGB", (int(w * PAD_FACTOR), int(h * PAD_FACTOR)), corner_color)
            offset_x = int(w * (PAD_FACTOR - 1) / 2)
            offset_y = int(h * (PAD_FACTOR - 1) / 2)
            canvas.paste(pil_img, (offset_x, offset_y))
            arr = np.ascontiguousarray(np.asarray(canvas, dtype=np.uint8))
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=arr)
            timestamp = int(frame_idx / fps * 1000)
            try:
                detection = detector.detect_for_video(mp_image, timestamp)
                if detection and detection.pose_landmarks:
                    landmarks = detection.pose_landmarks[0] if isinstance(detection.pose_landmarks, list) else detection.pose_landmarks
                    if landmarks:
                        kps = np.array([[l.x, l.y, l.z, l.visibility] for l in landmarks], dtype=np.float32)
                        results.append((frame_idx, timestamp, kps))
                        extracted += 1
            except Exception as e:
                pass
        frame_idx += 1
        if extracted >= max_frames:
            break
    cap.release()
    return results, None

def extract_image_mode(video_path, conf=0.3, max_frames=100):
    base_options_img = mp.tasks.BaseOptions(model_asset_path=str(MODEL_PATH), delegate=mp.tasks.BaseOptions.Delegate.CPU)
    options = _vision.PoseLandmarkerOptions(
        base_options=base_options_img,
        running_mode=_vision.RunningMode.IMAGE,
        min_pose_detection_confidence=conf,
        min_pose_presence_confidence=conf,
        min_tracking_confidence=conf,
        num_poses=1,
        output_segmentation_masks=False,
    )
    detector = _vision.PoseLandmarker.create_from_options(options)
    
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return [], "could not open"
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_step = max(1, int(fps / TARGET_FPS))
    results = []
    frame_idx = 0
    extracted = 0
    while True:
        ret, frame_bgr = cap.read()
        if not ret:
            break
        if frame_idx % frame_step == 0:
            frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(frame_rgb)
            w, h = pil_img.size
            corner_color = pil_img.getpixel((0, 0))
            canvas = Image.new("RGB", (int(w * PAD_FACTOR), int(h * PAD_FACTOR)), corner_color)
            offset_x = int(w * (PAD_FACTOR - 1) / 2)
            offset_y = int(h * (PAD_FACTOR - 1) / 2)
            canvas.paste(pil_img, (offset_x, offset_y))
            arr = np.ascontiguousarray(np.asarray(canvas, dtype=np.uint8))
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=arr)
            try:
                detection = detector.detect(mp_image)
                if detection and detection.pose_landmarks:
                    landmarks = detection.pose_landmarks[0] if isinstance(detection.pose_landmarks, list) else detection.pose_landmarks
                    if landmarks:
                        kps = np.array([[l.x, l.y, l.z, l.visibility] for l in landmarks], dtype=np.float32)
                        results.append((frame_idx, kps))
                        extracted += 1
            except Exception as e:
                pass
        frame_idx += 1
        if extracted >= max_frames:
            break
    cap.release()
    return results, None

def count_visible(kps_array, threshold=0.5):
    if len(kps_array) == 0:
        return []
    counts = []
    for item in kps_array:
        kps = item[-1]
        vis = kps[:, 3]
        counts.append(int(np.sum(vis > threshold)))
    return counts

def main():
    print(f"=== T1 Quick: Testing {len(TEST_VIDEOS)} PushUpBench videos ===")
    all_results = {}
    
    for i, vid_name in enumerate(TEST_VIDEOS):
        video_path = Path("data/raw/real_video/pushupbench") / vid_name
        if not video_path.exists():
            print(f"[{i+1}/{len(TEST_VIDEOS)}] MISSING: {vid_name}")
            all_results[vid_name] = {"error": "file not found"}
            continue
        
        print(f"[{i+1}/{len(TEST_VIDEOS)}] {vid_name}")
        vid_out_dir = OUTPUT_DIR / vid_name.replace(".mp4", "")
        vid_out_dir.mkdir(exist_ok=True)
        
        meta = get_video_metadata(video_path)
        frames = save_frames(video_path, vid_out_dir, num_frames=3)
        
        det = create_detector(CONF_THRESHOLD)
        kps_video, err = extract_video_mode(video_path, det, conf=CONF_THRESHOLD, max_frames=60)
        
        kps_image, _ = extract_image_mode(video_path, conf=CONF_THRESHOLD, max_frames=60)
        
        det_05 = create_detector(0.5)
        kps_conf05, _ = extract_video_mode(video_path, det_05, conf=0.5, max_frames=60)
        
        vis_video = count_visible(kps_video)
        vis_image = count_visible(kps_image)
        
        # Expected frames at 15fps
        expected_frames = max(1, int(meta["frame_count"] / max(1, meta["fps"] / TARGET_FPS)))
        
        result = {
            "video": vid_name,
            "metadata": meta,
            "expected_frames_15fps": expected_frames,
            "saved_frames": frames,
            "video_mode": {
                "frames_with_pose": len(kps_video),
                "detection_rate": len(kps_video) / expected_frames,
                "avg_visible": float(np.mean(vis_video)) if vis_video else 0,
                "visible_distribution": vis_video[:20],
            },
            "image_mode": {
                "frames_with_pose": len(kps_image),
                "detection_rate": len(kps_image) / expected_frames,
                "avg_visible": float(np.mean(vis_image)) if vis_image else 0,
                "visible_distribution": vis_image[:20],
            },
            "confidence_05": {
                "frames_with_pose": len(kps_conf05),
            },
            "error": err,
        }
        all_results[vid_name] = result
        
        m = meta
        print(f"  CV2: {m['frame_count']} frames @ {m['fps']:.1f} FPS, {m['width']}x{m['height']}")
        print(f"  Expected @15fps: {expected_frames}")
        print(f"  VIDEO mode: {len(kps_video)} pose ({result['video_mode']['detection_rate']*100:.1f}%), avg vis: {result['video_mode']['avg_visible']:.1f}")
        print(f"  IMAGE mode: {len(kps_image)} pose ({result['image_mode']['detection_rate']*100:.1f}%), avg vis: {result['image_mode']['avg_visible']:.1f}")
        print(f"  Conf 0.5: {len(kps_conf05)} pose")
        print()
    
    out_path = OUTPUT_DIR / "t1_quick_results.json"
    with open(out_path, "w") as f:
        json.dump(all_results, f, indent=2)
    print(f"Results saved to {out_path}")
    
    print("\n=== SUMMARY TABLE ===")
    print(f"{'Video':<45} {'CV2fr':>6} {'FPS':>5} {'Res':>10} {'Exp15':>6} {'VID':>4} {'VID%':>5} {'IMG':>4} {'IMG%':>5} {'C0.5':>4}")
    for vid, r in all_results.items():
        if "error" in r:
            print(f"{vid:<45} ERROR: {r['error']}")
            continue
        m = r["metadata"]
        vm = r["video_mode"]["frames_with_pose"]
        im = r["image_mode"]["frames_with_pose"]
        c5 = r["confidence_05"]["frames_with_pose"]
        exp = r["expected_frames_15fps"]
        print(f"{vid:<45} {m['frame_count']:>6} {m['fps']:>5.1f} {m['width']}x{m['height']:<4} {exp:>6} {vm:>4} {r['video_mode']['detection_rate']*100:>5.1f} {im:>4} {r['image_mode']['detection_rate']*100:>5.1f} {c5:>4}")
    
    return all_results

if __name__ == "__main__":
    main()