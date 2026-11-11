#!/usr/bin/env python3
"""R4: PushUpBench evaluation - resumable with download, proper taxonomy mapping.
Evaluates frozen GIF-trained CNN1D on real video with ground-truth rep counts.
"""
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
import re
import hashlib

# ── Load models ────────────────────────────────────────────────────────────
MODEL_PATH = Path("models/pose_landmarker_heavy.task")
assert MODEL_PATH.exists()

# Load ONNX classifier
cnn_session = ort.InferenceSession("ml/models/cnn1d_int8.onnx")
cnn_input = cnn_session.get_inputs()[0].name

# Load class mapping
with open("data/windows/class_to_idx.json") as f:
    class_to_idx = json.load(f)
idx_to_class = {v: k for k, v in class_to_idx.items()}

# Load PushUpBench taxonomy mapping
with open("configs/pushupbench_taxonomy_mapping.json") as f:
    pb_mapping = json.load(f)

PAD_FACTOR = 1.5
TARGET_FPS = 15
WINDOW_SIZE = 48

# ── Results paths ──────────────────────────────────────────────────────────
RESULTS_PATH = Path("reports/pushupbench_evaluation.json")
RESULTS_DIR = RESULTS_PATH.parent
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

# ── Download manifest ──────────────────────────────────────────────────────
MANIFEST_PATH = Path("data/raw/real_video/pushupbench/download_manifest.json")

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

def download_with_retry(repo_id, filename, local_dir, max_retries=3):
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

def create_detector(detection_conf=0.3, presence_conf=0.3, tracking_conf=0.3):
    base_options = mp.tasks.BaseOptions(model_asset_path=str(MODEL_PATH), delegate=mp.tasks.BaseOptions.Delegate.CPU)
    options = vision.PoseLandmarkerOptions(
        base_options=base_options,
        running_mode=vision.RunningMode.VIDEO,
        min_pose_detection_confidence=detection_conf,
        min_pose_presence_confidence=presence_conf,
        min_tracking_confidence=tracking_conf,
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
                pass  # Continue on detection errors
        frame_idx += 1
    
    cap.release()
    
    if len(all_kps) < 5:
        return None, f"too few frames with pose ({len(all_kps)})"
    
    return np.array(all_kps), None  # (T, 33, 4)

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

def count_reps_from_angles(keypoints_seq, joint_indices):
    """Count reps from joint angle valleys."""
    angles = []
    for t in range(keypoints_seq.shape[0]):
        a, b, c = keypoints_seq[t, joint_indices[0], :3], keypoints_seq[t, joint_indices[1], :3], keypoints_seq[t, joint_indices[2], :3]
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

def parse_rep_count(filename):
    """Extract ground-truth rep count from filename bracket."""
    match = re.search(r'_\[(\d+(?:-\d+)*)\]', filename)
    if match:
        parts = match.group(1).split('-')
        if len(parts) == 1:
            return int(parts[0]), "single"
        else:
            return sum(int(p) for p in parts) / len(parts), "multi"
    return None, "none"

# ── Main ───────────────────────────────────────────────────────────────────
def load_existing_results():
    if RESULTS_PATH.exists():
        with open(RESULTS_PATH) as f:
            return json.load(f)
    return []

def save_results(results):
    with open(RESULTS_PATH, "w") as f:
        json.dump(results, f, indent=2)

def main():
    global cnn_session, cnn_input, idx_to_class
    
    # Load existing results for resume
    results = load_existing_results()
    processed_videos = {r["video"] for r in results if "error" not in r}
    print(f"Resuming: {len(processed_videos)} already processed", flush=True)
    
    # Download phase
    RAW_DIR = Path("data/raw/real_video/pushupbench")
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    
    manifest = load_download_manifest()
    
    print("Listing files on Hugging Face...", flush=True)
    all_files = list_repo_files("anonymousatom/pushupbench", repo_type="dataset")
    all_mp4 = [f for f in all_files if f.endswith(".mp4")]
    print(f"Total MP4s on HF: {len(all_mp4)}", flush=True)
    
    local_files = set(f.name for f in RAW_DIR.glob("*.mp4"))
    print(f"Already local: {len(local_files)}", flush=True)
    
    # Update manifest
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
    
    missing = [f for f in all_mp4 if f not in local_files or manifest["files"][f]["status"] != "complete"]
    print(f"Missing or incomplete: {len(missing)} / {len(all_mp4)}", flush=True)
    
    if missing:
        print(f"Starting download of {len(missing)} files...", flush=True)
        download_start = time.time()
        
        for i, mp4_file in enumerate(missing):
            manifest["files"][mp4_file]["attempts"] += 1
            print(f"\n[{i+1}/{len(missing)}] Downloading: {mp4_file}", flush=True)
            
            local_path, error = download_with_retry("anonymousatom/pushupbench", mp4_file, RAW_DIR)
            
            if local_path:
                size = os.path.getsize(local_path)
                sha = file_hash(local_path)
                manifest["files"][mp4_file].update({
                    "status": "complete",
                    "local_path": str(local_path),
                    "size_bytes": size,
                    "sha256": sha,
                    "last_error": ""
                })
                print(f"  Downloaded: {mp4_file} ({size/1e6:.1f} MB)", flush=True)
            else:
                manifest["files"][mp4_file].update({
                    "status": "failed",
                    "last_error": error
                })
                print(f"  FAILED: {mp4_file}: {error}", flush=True)
            
            if (i + 1) % 10 == 0:
                manifest["last_updated"] = time.time()
                save_download_manifest(manifest)
                elapsed = time.time() - download_start
                print(f"  Progress: {i+1}/{len(missing)}, elapsed: {elapsed:.0f}s", flush=True)
        
        manifest["last_updated"] = time.time()
        save_download_manifest(manifest)
        total_download_time = time.time() - download_start
        print(f"\nDownload phase complete in {total_download_time:.0f}s", flush=True)
    
    # Re-scan local files
    local_videos = sorted(RAW_DIR.glob("*.mp4"))
    print(f"Total local videos: {len(local_videos)}", flush=True)
    
    # Filter to unprocessed
    to_process = [v for v in local_videos if v.name not in processed_videos]
    print(f"Remaining to process: {len(to_process)}", flush=True)
    
    # Create detector with very low confidence for floor exercises
    detector = create_detector(detection_conf=0.05, presence_conf=0.05, tracking_conf=0.05)
    
    eval_start = time.time()
    
    for i, video_path in enumerate(to_process):
        name = video_path.name
        
        # Parse exercise name and expected pattern
        parts = name.replace(".mp4", "").split("_", 2)
        if len(parts) >= 3:
            ex_name = parts[2].rsplit("_", 1)[0].lower()
        else:
            ex_name = name.lower()
        
        expected_pattern = pb_mapping.get(ex_name, "unknown")
        
        # Parse ground-truth rep count
        gt_reps, rep_type = parse_rep_count(name)
        
        print(f"\n[{len(processed_videos)+i+1}/{len(local_videos)}] {name}", flush=True)
        print(f"  Exercise: {ex_name} -> Expected: {expected_pattern} | GT Reps: {gt_reps} ({rep_type})", flush=True)
        
        try:
            kps, error = extract_from_video(video_path, detector)
            if kps is None:
                print(f"  Failed: {error}", flush=True)
                results.append({"video": name, "exercise": ex_name, "expected": expected_pattern, 
                               "gt_reps": gt_reps, "gt_rep_type": rep_type, "error": error})
                continue
            
            # Resample to 48-frame window for classification
            resampled = resample_to_48(kps)
            pred, conf = classify_window(resampled)
            
            # Count reps based on exercise pattern
            rep_count = 0
            joint_map = {
                "horizontal_push": (12, 14, 16),
                "squat": (24, 26, 28),
                "hinge": (24, 26, 28),
                "core_flexion": (12, 14, 16),
                "cardio_dynamic": None,
                "core_isometric": None,
                "curl": (12, 14, 16),
                "lateral_raise": (12, 14, 16),
                "triceps_extension": (12, 14, 16),
                "horizontal_pull": (12, 14, 16),
            }
            
            if expected_pattern in joint_map and joint_map[expected_pattern]:
                rep_count = count_reps_from_angles(kps, joint_map[expected_pattern])
            
            result = {
                "video": name,
                "exercise": ex_name,
                "expected_pattern": expected_pattern,
                "predicted_pattern": pred,
                "confidence": conf,
                "pattern_match": pred == expected_pattern,
                "gt_reps": gt_reps,
                "gt_rep_type": rep_type,
                "pred_reps": rep_count,
                "rep_error": abs(rep_count - gt_reps) if gt_reps is not None else None,
                "frames_with_pose": len(kps),
                "video_duration_sec": len(kps) / TARGET_FPS,
            }
            results.append(result)
            print(f"  Pred: {pred} (conf={conf:.3f}) | Match: {pred == expected_pattern} | GT Reps: {gt_reps} | Pred Reps: {rep_count}", flush=True)
            
        except Exception as e:
            print(f"  Error: {e}", flush=True)
            import traceback
            traceback.print_exc()
            results.append({"video": name, "exercise": ex_name, "expected": expected_pattern, 
                           "gt_reps": gt_reps, "gt_rep_type": rep_type, "error": str(e)})
        
        # Save incrementally every 5 videos
        if (i + 1) % 5 == 0:
            save_results(results)
            elapsed = time.time() - eval_start
            print(f"  Saved checkpoint. Elapsed: {elapsed:.0f}s", flush=True)
    
    # Final save
    save_results(results)
    total_time = time.time() - eval_start
    print(f"\nEvaluation complete in {total_time:.0f}s", flush=True)
    
    # Summary
    successful = [r for r in results if "error" not in r]
    matches = [r for r in successful if r["pattern_match"]]
    print(f"\n=== PUSHUPBENCH EVALUATION SUMMARY ===", flush=True)
    print(f"Total videos: {len(results)}", flush=True)
    print(f"Successful: {len(successful)}", flush=True)
    print(f"Errors: {len(results) - len(successful)}", flush=True)
    if successful:
        print(f"Pattern match accuracy: {len(matches)}/{len(successful)} = {len(matches)/len(successful)*100:.1f}%", flush=True)
    
    # Per-pattern breakdown
    expected_counts = Counter(r["expected_pattern"] for r in successful)
    predicted_counts = Counter(r["predicted_pattern"] for r in successful)
    print(f"\nExpected distribution: {dict(expected_counts)}", flush=True)
    print(f"Predicted distribution: {dict(predicted_counts)}", flush=True)
    
    # Confusion matrix
    from sklearn.metrics import confusion_matrix, classification_report
    class_names = list(class_to_idx.keys())
    y_true = [class_to_idx[r["expected_pattern"]] for r in successful if r["expected_pattern"] != "unknown"]
    y_pred = [class_to_idx[r["predicted_pattern"]] for r in successful if r["expected_pattern"] != "unknown"]
    if y_true:
        cm = confusion_matrix(y_true, y_pred)
        print(f"\nConfusion Matrix:", flush=True)
        print(cm, flush=True)
        print(f"\nClassification Report (excl. unknown):", flush=True)
        print(classification_report(y_true, y_pred, target_names=[c for c in class_names if c != "unknown"], zero_division=0), flush=True)
    
    # Rep counting metrics
    rep_results = [r for r in successful if r["gt_reps"] is not None and r["gt_rep_type"] == "single"]
    if rep_results:
        rep_errors = [r["rep_error"] for r in rep_results if r["rep_error"] is not None]
        if rep_errors:
            mae = np.mean(rep_errors)
            exact = sum(1 for e in rep_errors if e == 0)
            off_by_one = sum(1 for e in rep_errors if e <= 1)
            print(f"\nRep Counting (single-set only, n={len(rep_errors)}):", flush=True)
            print(f"  MAE: {mae:.2f}", flush=True)
            print(f"  Exact: {exact}/{len(rep_errors)} = {exact/len(rep_errors)*100:.1f}%", flush=True)
            print(f"  Off-by-1: {off_by_one}/{len(rep_errors)} = {off_by_one/len(rep_errors)*100:.1f}%", flush=True)
    
    print(f"\nResults saved to: {RESULTS_PATH}", flush=True)

if __name__ == "__main__":
    main()