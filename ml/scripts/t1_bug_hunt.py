#!/usr/bin/env python3
"""
T1: Real-video extraction bug hunt using LITE model (what the app ships).
Tests 10 PushUpBench videos for frame count, fps, resolution, rotation metadata,
saves 3 decoded frames, and tests detection variants.
"""
import cv2
import numpy as np
import json
import os
from pathlib import Path
from PIL import Image
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision
import subprocess
import sys

# ── Config ───────────────────────────────────────────────────────────────────
MODEL_PATH = Path("models/pose_landmarker_lite.task")
assert MODEL_PATH.exists(), f"Model not found: {MODEL_PATH}"

PAD_FACTOR = 1.5
CONF_THRESHOLD = 0.3
TARGET_FPS = 15
NUM_TEST_VIDEOS = 10
OUTPUT_DIR = Path("reports/t1_bug_hunt")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# PushUpBench videos to test (prioritize those with ground-truth reps)
TEST_VIDEOS = [
    "01e83deb_0015_c-curl twist_[13].mp4",
    "04996ace_0016_reverse lunges challenge_[50].mp4",
    "14c2c3f4_0045_drop squats_[40].mp4",
    "14c2c3f4_0447_push up toe tap_[14-13-15].mp4",
    "14c2c3f4_0751_side plank raises(right side)_[51].mp4",
    "17e2d98f_0241_slow sq_[6].mp4",
    "17e2d98f_0341_step jacks_[30].mp4",
    "36f0d07e_0300_bicep curls_[24].mp4",
    "36f0d07e_0716_box push-ups_[11].mp4",
    "5e3a8d78_0514_push up (on knees)_[12].mp4",
]

# Also test a control clip - person standing/squatting
CONTROL_VIDEO = "control_standing_squat.mp4"

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

def get_video_metadata_cv2(video_path):
    """Get metadata using cv2."""
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return None
    meta = {
        "frame_count_cv2": int(cap.get(cv2.CAP_PROP_FRAME_COUNT)),
        "fps_cv2": cap.get(cv2.CAP_PROP_FPS),
        "width_cv2": int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
        "height_cv2": int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
        "fourcc": int(cap.get(cv2.CAP_PROP_FOURCC)),
    }
    cap.release()
    return meta

def get_video_metadata_ffprobe(video_path):
    """Get metadata using ffprobe (includes rotation)."""
    try:
        cmd = [
            "ffprobe", "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=width,height,r_frame_rate,rotation,displaymatrix",
            "-of", "json", str(video_path)
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        if result.returncode != 0:
            return {"error": result.stderr}
        data = json.loads(result.stdout)
        streams = data.get("streams", [])
        if not streams:
            return {"error": "no video stream"}
        s = streams[0]
        meta = {
            "width_ffprobe": s.get("width"),
            "height_ffprobe": s.get("height"),
            "r_frame_rate": s.get("r_frame_rate"),
            "rotation": s.get("rotation", 0),
            "displaymatrix": s.get("displaymatrix"),
        }
        # Parse frame rate
        if "r_frame_rate" in s:
            num, den = map(int, s["r_frame_rate"].split("/"))
            meta["fps_ffprobe"] = num / den if den else 0
        return meta
    except Exception as e:
        return {"error": str(e)}

def save_decoded_frames(video_path, output_dir, num_frames=3):
    """Save first, middle, last frames as PNG."""
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return []
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    indices = [0, total // 2, total - 1] if total >= 3 else list(range(min(total, num_frames)))
    saved = []
    for i, idx in enumerate(indices):
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ret, frame = cap.read()
        if ret:
            out_path = output_dir / f"{video_path.stem}_frame{idx}.png"
            cv2.imwrite(str(out_path), frame)
            saved.append({"frame_idx": idx, "path": str(out_path), "shape": frame.shape})
    cap.release()
    return saved

def extract_keypoints_video_mode(video_path, detector, conf=0.3, max_frames=None):
    """Extract keypoints using VIDEO mode (what the app uses)."""
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return [], "could not open"
    
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_step = max(1, int(fps / TARGET_FPS))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
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
            
            # Pad with corner color
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
        if max_frames and extracted >= max_frames:
            break
    
    cap.release()
    return results, None

def extract_keypoints_image_mode(video_path, conf=0.3, max_frames=None):
    """Extract keypoints using IMAGE mode (per-frame independent)."""
    # Create IMAGE mode detector
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
        if max_frames and extracted >= max_frames:
            break
    
    cap.release()
    return results, None

def test_model_variants(video_path, conf=0.3):
    """Test LITE vs FULL vs HEAVY model variants."""
    model_paths = {
        "lite": "models/pose_landmarker_lite.task",
        "full": "models/pose_landmarker_full.task",
        "heavy": "models/pose_landmarker_heavy.task",
    }
    results = {}
    for name, path in model_paths.items():
        if not Path(path).exists():
            results[name] = {"error": "model not found"}
            continue
        base_opts = mp.tasks.BaseOptions(model_asset_path=path, delegate=mp.tasks.BaseOptions.Delegate.CPU)
        opts = _vision.PoseLandmarkerOptions(
            base_options=base_opts,
            running_mode=_vision.RunningMode.VIDEO,
            min_pose_detection_confidence=conf,
            min_pose_presence_confidence=conf,
            min_tracking_confidence=conf,
            num_poses=1,
            output_segmentation_masks=False,
        )
        det = _vision.PoseLandmarker.create_from_options(opts)
        kps, err = extract_keypoints_video_mode(video_path, det, conf=conf, max_frames=50)
        results[name] = {"frames_with_pose": len(kps), "error": err}
    return results

def downscale_upscale_test(video_path, conf=0.3):
    """Test with downscale to max side 640 or upscale small."""
    cap = cv2.VideoCapture(str(video_path))
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    cap.release()
    
    results = {}
    
    # Original
    det = create_detector(conf)
    kps, _ = extract_keypoints_video_mode(video_path, det, conf=conf, max_frames=30)
    results["original"] = {"frames_with_pose": len(kps), "resolution": f"{w}x{h}"}
    
    # Downscale if larger than 640
    if max(w, h) > 640:
        # We'd need to modify extraction - skip for now, just note
        results["note"] = f"Original {w}x{h} > 640, would downscale"
    
    # Upscale if small
    if max(w, h) < 480:
        results["note"] = f"Original {w}x{h} < 480, would upscale"
    
    return results

def count_visible_keypoints(kps_array, threshold=0.5):
    """Count keypoints with visibility > threshold per frame.
    Handles both VIDEO mode (frame_idx, timestamp, kps) and IMAGE mode (frame_idx, kps)."""
    if len(kps_array) == 0:
        return []
    counts = []
    for item in kps_array:
        kps = item[-1]  # last element is always keypoints
        vis = kps[:, 3]
        counts.append(int(np.sum(vis > threshold)))
    return counts

def main():
    print(f"=== T1 Bug Hunt: Testing {NUM_TEST_VIDEOS} PushUpBench videos ===")
    print(f"Model: {MODEL_PATH.name}")
    print(f"Pad factor: {PAD_FACTOR}, Conf: {CONF_THRESHOLD}, Target FPS: {TARGET_FPS}")
    print()
    
    all_results = {}
    
    for i, vid_name in enumerate(TEST_VIDEOS):
        video_path = Path("data/raw/real_video/pushupbench") / vid_name
        if not video_path.exists():
            print(f"[{i+1}/{NUM_TEST_VIDEOS}] MISSING: {vid_name}")
            all_results[vid_name] = {"error": "file not found"}
            continue
        
        print(f"[{i+1}/{NUM_TEST_VIDEOS}] {vid_name}")
        
        vid_out_dir = OUTPUT_DIR / vid_name.replace(".mp4", "")
        vid_out_dir.mkdir(exist_ok=True)
        
        # 1. Video metadata
        meta_cv2 = get_video_metadata_cv2(video_path)
        meta_ffprobe = get_video_metadata_ffprobe(video_path)
        
        # 2. Save 3 decoded frames
        frames = save_decoded_frames(video_path, vid_out_dir, num_frames=3)
        
        # 3. Extract with VIDEO mode (app default)
        det = create_detector(CONF_THRESHOLD)
        kps_video, err = extract_keypoints_video_mode(video_path, det, conf=CONF_THRESHOLD)
        
        # 4. Extract with IMAGE mode
        kps_image, _ = extract_keypoints_image_mode(video_path, conf=CONF_THRESHOLD)
        
        # 5. Confidence threshold test (0.3 vs 0.5)
        det_05 = create_detector(0.5)
        kps_conf05, _ = extract_keypoints_video_mode(video_path, det_05, conf=0.5)
        
        # 6. Model variants
        variants = test_model_variants(video_path, CONF_THRESHOLD)
        
        # 7. Downscale/upscale note
        downscale = downscale_upscale_test(video_path, CONF_THRESHOLD)
        
        # Visible keypoint counts
        vis_counts_video = count_visible_keypoints(kps_video)
        vis_counts_image = count_visible_keypoints(kps_image)
        
        result = {
            "video": vid_name,
            "metadata_cv2": meta_cv2,
            "metadata_ffprobe": meta_ffprobe,
            "saved_frames": frames,
            "video_mode": {
                "frames_with_pose": len(kps_video),
                "detection_rate": len(kps_video) / max(1, meta_cv2["frame_count_cv2"] // max(1, int(meta_cv2["fps_cv2"] / TARGET_FPS))) if meta_cv2 else 0,
                "visible_keypoints_per_frame": vis_counts_video[:10],  # first 10
                "avg_visible": float(np.mean(vis_counts_video)) if vis_counts_video else 0,
            },
            "image_mode": {
                "frames_with_pose": len(kps_image),
                "detection_rate": len(kps_image) / max(1, meta_cv2["frame_count_cv2"] // max(1, int(meta_cv2["fps_cv2"] / TARGET_FPS))) if meta_cv2 else 0,
                "visible_keypoints_per_frame": vis_counts_image[:10],
                "avg_visible": float(np.mean(vis_counts_image)) if vis_counts_image else 0,
            },
            "confidence_05": {
                "frames_with_pose": len(kps_conf05),
            },
            "model_variants": variants,
            "downscale_note": downscale,
            "error": err,
        }
        
        all_results[vid_name] = result
        
        # Print summary
        print(f"  CV2: {meta_cv2['frame_count_cv2']} frames @ {meta_cv2['fps_cv2']:.1f} FPS, {meta_cv2['width_cv2']}x{meta_cv2['height_cv2']}")
        print(f"  FFprobe rotation: {meta_ffprobe.get('rotation', 0)}")
        print(f"  VIDEO mode: {len(kps_video)} frames with pose (avg vis: {result['video_mode']['avg_visible']:.1f})")
        print(f"  IMAGE mode: {len(kps_image)} frames with pose (avg vis: {result['image_mode']['avg_visible']:.1f})")
        print(f"  Conf 0.5: {len(kps_conf05)} frames with pose")
        print(f"  Variants: L={variants.get('lite',{}).get('frames_with_pose','?')} F={variants.get('full',{}).get('frames_with_pose','?')} H={variants.get('heavy',{}).get('frames_with_pose','?')}")
        print()
    
    # Save full results
    out_path = OUTPUT_DIR / "t1_results.json"
    with open(out_path, "w") as f:
        json.dump(all_results, f, indent=2)
    print(f"Results saved to {out_path}")
    
    # Summary table
    print("\n=== SUMMARY ===")
    print(f"{'Video':<45} {'CV2 frames':>10} {'FPS':>6} {'Res':>10} {'Rot':>4} {'VIDEO pose':>10} {'IMAGE pose':>10} {'Conf0.5':>8}")
    for vid, r in all_results.items():
        if "error" in r:
            print(f"{vid:<45} ERROR: {r['error']}")
            continue
        m = r["metadata_cv2"]
        rot = r["metadata_ffprobe"].get("rotation", 0)
        vm = r["video_mode"]["frames_with_pose"]
        im = r["image_mode"]["frames_with_pose"]
        c5 = r["confidence_05"]["frames_with_pose"]
        print(f"{vid:<45} {m['frame_count_cv2']:>10} {m['fps_cv2']:>6.1f} {m['width_cv2']}x{m['height_cv2']:<4} {rot:>4} {vm:>10} {im:>10} {c5:>8}")
    
    return all_results

if __name__ == "__main__":
    main()