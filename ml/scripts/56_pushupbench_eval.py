#!/usr/bin/env python3
"""R4: PushUpBench extraction completion + classifier/rep evaluation on real video.
Fixed: full download, no artificial limits, resumable with manifest, proper error handling."""
import cv2
import numpy as np
import json
import time
import os
from pathlib import Path
from huggingface_hub import list_repo_files, hf_hub_download
import onnxruntime as ort
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision
from PIL import Image
from collections import Counter
import hashlib

# ── Load models ────────────────────────────────────────────────────────────
MODEL_PATH = Path("models/pose_landmarker_lite.task")
assert MODEL_PATH.exists()

_base_options = mp.tasks.BaseOptions(model_asset_path=str(MODEL_PATH), delegate=mp.tasks.BaseOptions.Delegate.CPU)
_options = vision.PoseLandmarkerOptions(
    base_options=_base_options,
    running_mode=vision.RunningMode.VIDEO,
    min_pose_detection_confidence=0.3,
    min_pose_presence_confidence=0.3,
    min_tracking_confidence=0.3,
    num_poses=1,
    output_segmentation_masks=False,
)
_detector = vision.PoseLandmarker.create_from_options(_options)

# Load ONNX classifier
cnn_session = ort.InferenceSession("ml/models/cnn1d_int8.onnx")
cnn_input = cnn_session.get_inputs()[0].name

# Load class mapping
with open("data/windows/class_to_idx.json") as f:
    class_to_idx = json.load(f)
idx_to_class = {v: k for k, v in class_to_idx.items()}

# PushUpBench pattern mapping
pb_pattern_map = {
    "c-curl twist": "core_flexion",
    "knee to chest": "core_flexion",
    "bent scissor": "core_flexion",
    "toe taps": "core_flexion",
    "leg extension + crunch [l]": "core_flexion",
    "side crunch + leg stretch [l]": "core_flexion",
    "leg extension + crunch [r]": "core_flexion",
    "side crunch + leg stretch [r]": "core_flexion",
    "reverse lunges challenge": "squat",
    "leg lift": "core_flexion",
    "donkey kick + cross": "hinge",
    "donkey twist": "core_flexion",
    "rainbow": "core_flexion",
    "crossed side kick": "hinge",
    "hamstring curl": "hinge",
    "side leg lift": "lateral_raise",
    "leg swipe": "hinge",
    "leg extension": "hinge",
    "leg circle": "hinge",
    "pointe to heel bridge": "hinge",
    "pointed glute bridge": "hinge",
    "1-leg glute bridge": "hinge",
    "straight leg lift [r]": "core_flexion",
}

PAD_FACTOR = 1.5
OFFSET = 0.25
TARGET_FPS = 15
WINDOW_SIZE = 48

# ── Download manifest ─────────────────────────────────────────────────────
MANIFEST_PATH = Path("ml/data/raw/real_video/pushupbench/download_manifest.json")

def load_download_manifest():
    if MANIFEST_PATH.exists():
        with open(MANIFEST_PATH) as f:
            return json.load(f)
    return {"files": {}, "last_updated": None}

def save_download_manifest(manifest):
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(MANIFEST_PATH, "w") as f:
        json.dump(manifest, f, indent=2)

def file_hash(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()

# ── Helpers ────────────────────────────────────────────────────────────────
def pad_image(im):
    w, h = im.size
    corner_color = im.getpixel((0, 0))
    canvas = Image.new("RGB", (int(w * PAD_FACTOR), int(h * PAD_FACTOR)), corner_color)
    offset_x = int(w * (PAD_FACTOR - 1) / 2)
    offset_y = int(h * (PAD_FACTOR - 1) / 2)
    canvas.paste(im, (offset_x, offset_y))
    return canvas

def normalize_kps(kps):
    hip = kps[[23, 24]]; mid_hip = (hip[0] + hip[1]) / 2
    shoulder = kps[[11, 12]]; mid_shoulder = (shoulder[0] + shoulder[1]) / 2
    kps_centered = kps.copy()
    kps_centered[:, :3] -= mid_hip[:3]
    torso_vec = mid_hip[:2] - mid_shoulder[:2]
    torso_len = np.hypot(torso_vec[0], torso_vec[1]) + 1e-6
    kps_centered[:, :3] /= torso_len
    return kps_centered.astype(np.float32)

def unpad_kps(kps):
    kps[:, 0] = kps[:, 0] * PAD_FACTOR - 0.25
    kps[:, 1] = kps[:, 1] * PAD_FACTOR - 0.25
    kps[:, 2] = kps[:, 2] * PAD_FACTOR
    return kps

def create_detector():
    base_options = mp.tasks.BaseOptions(model_asset_path=str(MODEL_PATH), delegate=mp.tasks.BaseOptions.Delegate.CPU)
    options = vision.PoseLandmarkerOptions(
        base_options=base_options,
        running_mode=vision.RunningMode.VIDEO,
        min_pose_detection_confidence=0.3,
        min_pose_presence_confidence=0.3,
        min_tracking_confidence=0.3,
        num_poses=1,
        output_segmentation_masks=False,
    )
    return vision.PoseLandmarker.create_from_options(options)

def extract_from_video(video_path, detector):
    """Extract keypoints from video, return (T, 33, 4) normalized."""
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return None, "could not open video"
    
    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0:
        cap.release()
        return None, "invalid fps"
    
    frame_step = max(1, int(fps / TARGET_FPS))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    all_kps = []
    frame_idx = 0
    frames_read = 0
    
    while True:
        ret, frame_bgr = cap.read()
        if not ret:
            break
        frames_read += 1
        
        if frame_idx % frame_step == 0:
            frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(frame_rgb)
            padded = pad_image(pil_img)
            
            arr = np.ascontiguousarray(np.asarray(padded, dtype=np.uint8))
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=arr)
            timestamp = int(frame_idx / fps * 1000)
            
            try:
                detection = detector.detect_for_video(mp_image, timestamp)
                if detection and detection.pose_landmarks:
                    landmarks = detection.pose_landmarks[0] if isinstance(detection.pose_landmarks, list) else detection.pose_landmarks
                    kps = np.array([[l.x, l.y, l.z, l.visibility] for l in landmarks], dtype=np.float32)
                    kps = unpad_kps(kps)
                    kps = normalize_kps(kps)
                    all_kps.append(kps)
            except Exception as e:
                # Log but continue
                print(f"  Frame {frame_idx}: detection error: {e}")
        frame_idx += 1
    
    cap.release()
    
    if len(all_kps) < 5:
        return None, f"too few frames with pose ({len(all_kps)})"
    
    return np.array(all_kps), None  # (T, 33, 4)

def pad_image(im):
    w, h = im.size
    corner_color = im.getpixel((0, 0))
    canvas = Image.new("RGB", (int(w * PAD_FACTOR), int(h * PAD_FACTOR)), corner_color)
    offset_x = int(w * (PAD_FACTOR - 1) / 2)
    offset_y = int(h * (PAD_FACTOR - 1) / 2)
    canvas.paste(im, (offset_x, offset_y))
    return canvas

def normalize_kps(kps):
    hip = kps[[23, 24]]; mid_hip = (hip[0] + hip[1]) / 2
    shoulder = kps[[11, 12]]; mid_shoulder = (shoulder[0] + shoulder[1]) / 2
    kps_centered = kps.copy()
    kps_centered[:, :3] -= mid_hip[:3]
    torso_vec = mid_hip[:2] - mid_shoulder[:2]
    torso_len = np.hypot(torso_vec[0], torso_vec[1]) + 1e-6
    kps_centered[:, :3] /= torso_len
    return kps_centered.astype(np.float32)

def unpad_kps(kps):
    kps[:, 0] = kps[:, 0] * PAD_FACTOR - 0.25
    kps[:, 1] = kps[:, 1] * PAD_FACTOR - 0.25
    kps[:, 2] = kps[:, 2] * PAD_FACTOR
    return kps

def resample_to_48(seq):
    if seq.shape[0] == 48:
        return seq
    T = seq.shape[0]
    t_orig = np.linspace(0, 1, T)
    t_new = np.linspace(0, 1, 48)
    res = np.empty((48, 33, 4), dtype=np.float32)
    for j in range(33):
        for c in range(4):
            res[:, j, c] = np.interp(t_new, t_orig, seq[:, j, c])
    return res

def classify_window(window):
    """window: (48, 33, 4) -> class, confidence"""
    x = window.reshape(1, 48, 132).astype(np.float32)
    out = cnn_session.run(None, {cnn_input: x})[0]
    probs = np.exp(out[0]) / np.sum(np.exp(out[0]))
    pred = np.argmax(probs)
    return idx_to_class[pred], float(probs[pred])

def count_pushup_reps(keypoints_seq):
    """Count reps from push-up elbow angle."""
    angles = []
    for t in range(keypoints_seq.shape[0]):
        a, b, c = keypoints_seq[t, 12, :3], keypoints_seq[t, 14, :3], keypoints_seq[t, 16, :3]
        ba = a - b; bc = c - b
        cosine = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-8)
        angles.append(np.degrees(np.arccos(np.clip(cosine, -1, 1))))
    
    angles = np.array(angles)
    if len(angles) < 10:
        return 0
    
    from scipy.ndimage import gaussian_filter1d
    smooth = gaussian_filter1d(angles, sigma=1.0)
    
    from scipy.signal import find_peaks
    valleys, _ = find_peaks(-smooth, prominence=10, distance=12)
    return len(valleys)

def download_with_retry(repo_id, filename, local_dir, max_retries=3):
    """Download with exponential backoff retry."""
    for attempt in range(max_retries):
        try:
            local_path = hf_hub_download(
                repo_id=repo_id,
                filename=filename,
                repo_type="dataset",
                local_dir=local_dir,
                local_dir_use_symlinks=False
            )
            return local_path, None
        except Exception as e:
            if attempt == max_retries - 1:
                return None, str(e)
            wait_time = 2 ** attempt
            print(f"  Retry {attempt + 1}/{max_retries} after {wait_time}s: {e}")
            time.sleep(wait_time)
    return None, "max retries exceeded"

# ── Main ───────────────────────────────────────────────────────────────────
def main():
    from pathlib import Path
    from PIL import Image
    
    RAW_DIR = Path("ml/data/raw/real_video/pushupbench")
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    
    # Load download manifest
    manifest = load_download_manifest()
    
    # List all files on HF
    print("Listing files on Hugging Face...")
    all_files = list_repo_files("anonymousatom/pushupbench", repo_type="dataset")
    all_mp4 = [f for f in all_files if f.endswith(".mp4")]
    print(f"Total MP4s on HF: {len(all_mp4)}")
    
    # Check local files
    local_files = set(f.name for f in Path("ml/data/raw/real_video/pushupbench").glob("*.mp4"))
    print(f"Already local: {len(local_files)}")
    
    # Update manifest with all files
    for mp4_file in all_mp4:
        if mp4_file not in manifest["files"]:
            manifest["files"][mp4_file] = {
                "status": "pending",
                "local_path": None,
                "size_bytes": 0,
                "sha256": "",
                "attempts": 0,
                "last_error": ""
            }
    
    # Determine which files need download
    missing = [f for f in all_mp4 if f not in local_files or manifest["files"][f]["status"] != "complete"]
    print(f"Missing or incomplete: {len(missing)} / {len(all_mp4)}")
    
    # Download missing files with retries
    print(f"Starting download of {len(missing)} files...")
    download_start = time.time()
    
    for i, mp4_file in enumerate(missing):
        manifest["files"][mp4_file]["attempts"] += 1
        print(f"\n[{i+1}/{len(missing)}] Downloading: {mp4_file}")
        
        local_path, error = download_with_retry("anonymousatom/pushupbench", mp4_file, 
                                                Path("ml/data/raw/real_video/pushupbench"))
        
        if local_path:
            # Verify file
            size = os.path.getsize(local_path)
            sha = file_hash(local_path)
            manifest["files"][mp4_file].update({
                "status": "complete",
                "local_path": str(local_path),
                "size_bytes": size,
                "sha256": sha,
                "last_error": ""
            })
            print(f"  Downloaded: {mp4_file} ({size/1e6:.1f} MB)")
        else:
            manifest["files"][mp4_file].update({
                "status": "failed",
                "last_error": error
            })
            print(f"  FAILED: {mp4_file}: {error}")
        
        # Save manifest periodically
        if (i + 1) % 10 == 0:
            manifest["last_updated"] = time.time()
            save_download_manifest(manifest)
            elapsed = time.time() - download_start
            print(f"  Progress: {i+1}/{len(missing)}, elapsed: {elapsed:.0f}s")
    
    manifest["last_updated"] = time.time()
    save_download_manifest(manifest)
    total_download_time = time.time() - download_start
    print(f"\nDownload phase complete in {total_download_time:.0f}s")
    
    # Re-scan local files
    local_files = list(Path("ml/data/raw/real_video/pushupbench").glob("*.mp4"))
    print(f"Total local videos: {len(local_files)}")
    
    # Load ONNX classifier
    global cnn_session, cnn_input, idx_to_class
    cnn_session = ort.InferenceSession("ml/models/cnn1d_int8.onnx")
    cnn_input = cnn_session.get_inputs()[0].name
    with open("data/windows/class_to_idx.json") as f:
        class_to_idx = json.load(f)
    idx_to_class = {v: k for k, v in class_to_idx.items()}
    
    # Process each video
    results = []
    eval_start = time.time()
    
    for i, video_path in enumerate(sorted(Path("ml/data/raw/real_video/pushupbench").glob("*.mp4"))):
        name = video_path.name
        # Parse exercise name: {id}_{num}_{name}_{count}.mp4
        parts = name.replace(".mp4", "").split("_", 2)
        if len(parts) >= 3:
            ex_name = parts[2].rsplit("_", 1)[0]
        else:
            ex_name = name
        expected_pattern = pb_pattern_map.get(ex_name, "unknown")
        
        print(f"\n[{i+1}/{len(local_files)}] Processing: {name} (expected: {expected_pattern})")
        
        # Create fresh detector per video
        detector = create_detector()
        
        try:
            kps, error = extract_from_video(video_path, detector)
            if kps is None:
                print(f"  Failed: {error}")
                results.append({"video": name, "expected": expected_pattern, "error": error})
                continue
            
            # Resample to 48-frame windows
            resampled = resample_to_48(kps)
            
            # Classify
            pred, conf = classify_window(resampled)
            
            # Count reps if push-up pattern
            rep_count = 0
            if "push" in expected_pattern.lower() or "push" in pred.lower():
                rep_count = count_pushup_reps(kps)
            
            result = {
                "video": name,
                "exercise_name": ex_name,
                "expected_pattern": expected_pattern,
                "predicted_pattern": pred,
                "confidence": conf,
                "pattern_match": pred == expected_pattern,
                "rep_count": rep_count,
                "frames_with_pose": len(kps),
            }
            results.append(result)
            print(f"  Pred: {pred} (conf={conf:.3f}) | Match: {pred == expected_pattern} | Reps: {rep_count}")
            
        except Exception as e:
            print(f"  Error: {e}")
            import traceback
            traceback.print_exc()
            results.append({"video": name, "expected": expected_pattern, "error": str(e)})
    
    # Save results
    output_path = Path("ml/reports/pushupbench_evaluation.json")
    with open(output_path, "w") as f:
        json.dump(results, f, indent=2)
    
    total_eval_time = time.time() - eval_start
    print(f"\nEvaluation complete in {total_eval_time:.0f}s")
    
    # Summary
    successful = [r for r in results if "error" not in r]
    matches = [r for r in successful if r["pattern_match"]]
    print(f"\n=== PUSHUPBENCH EVALUATION SUMMARY ===")
    print(f"Videos processed: {len(results)}")
    print(f"Successful: {len(successful)}")
    print(f"Pattern match accuracy: {len(matches)}/{len(successful)} = {len(matches)/len(successful)*100:.1f}%" if successful else "N/A")
    print(f"Results saved to: {output_path}")
    
    # Per-pattern breakdown
    expected_counts = Counter(r["expected_pattern"] for r in successful)
    predicted_counts = Counter(r["predicted_pattern"] for r in successful)
    print(f"\nExpected distribution: {dict(expected_counts)}")
    print(f"Predicted distribution: {dict(predicted_counts)}")

if __name__ == "__main__":
    main()