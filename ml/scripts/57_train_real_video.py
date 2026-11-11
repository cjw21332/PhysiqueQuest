#!/usr/bin/env python3
"""R5: Real-video training pipeline.
Extracts keypoints from PushUpBench standing subset, builds windows grouped by video/subject,
trains CNN1D/GRU on real video data with proper splits.
"""
import cv2
import numpy as np
import json
import time
import os
from pathlib import Path
from huggingface_hub import list_repo_files
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision
from PIL import Image
from collections import Counter
import re
import hashlib
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
from sklearn.metrics import classification_report, confusion_matrix, f1_score
from sklearn.model_selection import train_test_split

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
STRIDE = 24

# Standing patterns that work with MediaPipe Lite
STANDING_PATTERNS = ['squat', 'horizontal_push', 'cardio_dynamic', 'lateral_raise']

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
                pass
        frame_idx += 1
    
    cap.release()
    
    if len(all_kps) < WINDOW_SIZE:
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

def windows_from_sequence(seq, window_size=48, stride=24):
    """Extract sliding windows from sequence."""
    windows = []
    for start in range(0, len(seq) - window_size + 1, stride):
        window = seq[start:start + window_size]
        windows.append(window)
    return np.array(windows) if windows else np.empty((0, window_size, 33, 4))

# ── Main ───────────────────────────────────────────────────────────────────
def main():
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from src.pq_ml.models import CNN1DClassifier, GRUClassifier, count_parameters
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")
    
    # Load existing cached real video keypoints if available
    cache_dir = Path("data/keypoints_real_video")
    cache_dir.mkdir(parents=True, exist_ok=True)
    
    # List local videos
    video_dir = Path("data/raw/real_video/pushupbench")
    local_videos = sorted(video_dir.glob("*.mp4"))
    print(f"Total local videos: {len(local_videos)}")
    
    # Filter to standing exercises
    standing_videos = []
    for v in local_videos:
        parts = v.name.replace(".mp4", "").split("_", 2)
        if len(parts) >= 3:
            ex_name = parts[2].rsplit("_", 1)[0].lower()
            pattern = pb_mapping.get(ex_name, "unknown")
            if pattern in STANDING_PATTERNS:
                standing_videos.append((v, ex_name, pattern))
    
    print(f"Standing videos (target): {len(standing_videos)}")
    
    # Extract keypoints with caching
    detector = create_detector()
    all_windows = []
    all_labels = []
    video_groups = []  # group_id for each window
    
    print("\n=== Extracting keypoints from standing videos ===")
    for i, (video_path, ex_name, pattern) in enumerate(standing_videos):
        cache_file = cache_dir / f"{video_path.stem}.npz"
        
        if cache_file.exists():
            print(f"[{i+1}/{len(standing_videos)}] Loading cache: {video_path.name}")
            data = np.load(cache_file)
            kps = data['landmarks']
        else:
            print(f"[{i+1}/{len(standing_videos)}] Extracting: {video_path.name} (pattern: {pattern})")
            kps, error = extract_from_video(video_path, detector)
            if kps is None:
                print(f"  Failed: {error}")
                continue
            np.savez_compressed(cache_file, landmarks=kps, pattern=pattern, exercise=ex_name)
            print(f"  Extracted {len(kps)} frames, cached")
        
        # Resample to 48-frame windows with stride
        windows = windows_from_sequence(kps, WINDOW_SIZE, STRIDE)
        if len(windows) == 0:
            print(f"  Too short for windows: {len(kps)} frames")
            continue
        
        label_idx = class_to_idx[pattern]
        all_windows.append(windows)
        all_labels.extend([label_idx] * len(windows))
        video_groups.extend([f"{ex_name}_{i}"] * len(windows))
        print(f"  Generated {len(windows)} windows")
    
    if not all_windows:
        print("No windows generated!")
        return
    
    X = np.concatenate(all_windows, axis=0)  # (N, 48, 33, 4)
    y = np.array(all_labels)
    groups = np.array(video_groups)
    
    print(f"\n=== Total windows: {len(X)} ===")
    print(f"Class distribution: {Counter([idx_to_class[i] for i in y])}")
    print(f"Unique video groups: {len(np.unique(groups))}")
    
    # Flatten for model
    X_flat = X.reshape(len(X), 48, 132)
    
    # Split by video group (not by window!)
    unique_groups = np.unique(groups)
    train_groups, test_groups = train_test_split(unique_groups, test_size=0.2, random_state=42)
    train_groups, val_groups = train_test_split(train_groups, test_size=0.125, random_state=42)  # 0.125 * 0.8 = 0.1
    
    train_mask = np.isin(groups, train_groups)
    val_mask = np.isin(groups, val_groups)
    test_mask = np.isin(groups, test_groups)
    
    X_train, y_train = X_flat[train_mask], y[train_mask]
    X_val, y_val = X_flat[val_mask], y[val_mask]
    X_test, y_test = X_flat[test_mask], y[test_mask]
    
    print(f"\n=== Split sizes (by video group) ===")
    print(f"Train: {len(X_train)} windows from {len(train_groups)} groups")
    print(f"Val:   {len(X_val)} windows from {len(val_groups)} groups")
    print(f"Test:  {len(X_test)} windows from {len(test_groups)} groups")
    
    for split_name, (Xs, ys) in [("Train", (X_train, y_train)), ("Val", (X_val, y_val)), ("Test", (X_test, y_test))]:
        dist = Counter([idx_to_class[i] for i in ys])
        print(f"  {split_name}: {dict(dist)}")
    
    # Save splits
    np.save("data/real_video/train_X.npy", X_train)
    np.save("data/real_video/train_y.npy", y_train)
    np.save("data/real_video/val_X.npy", X_val)
    np.save("data/real_video/val_y.npy", y_val)
    np.save("data/real_video/test_X.npy", X_test)
    np.save("data/real_video/test_y.npy", y_test)
    
    # Training
    train_ds = TensorDataset(torch.from_numpy(X_train).float(), torch.from_numpy(y_train).long())
    val_ds = TensorDataset(torch.from_numpy(X_val).float(), torch.from_numpy(y_val).long())
    test_ds = TensorDataset(torch.from_numpy(X_test).float(), torch.from_numpy(y_test).long())
    
    train_loader = DataLoader(train_ds, batch_size=32, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=32, shuffle=False)
    test_loader = DataLoader(test_ds, batch_size=32, shuffle=False)
    
    # Train CNN1D
    print("\n=== Training CNN1D on real video ===")
    cnn = CNN1DClassifier(num_classes=len(class_to_idx)).to(device)
    print(f"Params: {count_parameters(cnn):,}")
    
    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
    optimizer = optim.AdamW(cnn.parameters(), lr=1e-3, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=60)
    
    best_val_f1 = 0
    best_state = None
    patience = 12
    patience_counter = 0
    
    for epoch in range(1, 61):
        # Train
        cnn.train()
        train_loss = 0
        for data, target in train_loader:
            data, target = data.to(device), target.to(device)
            optimizer.zero_grad()
            output = cnn(data)
            loss = criterion(output, target)
            loss.backward()
            optimizer.step()
            train_loss += loss.item()
        
        # Validate
        cnn.eval()
        val_loss = 0
        val_preds, val_targets = [], []
        with torch.no_grad():
            for data, target in val_loader:
                data, target = data.to(device), target.to(device)
                output = cnn(data)
                loss = criterion(output, target)
                val_loss += loss.item()
                val_preds.extend(output.argmax(1).cpu().numpy())
                val_targets.extend(target.cpu().numpy())
        
        val_f1 = f1_score(val_targets, val_preds, average='macro')
        scheduler.step()
        
        print(f"Epoch {epoch:3d}/60 | Train Loss: {train_loss/len(train_loader):.4f} | Val Loss: {val_loss/len(val_loader):.4f} | Val Macro-F1: {val_f1:.4f}")
        
        if val_f1 > best_val_f1:
            best_val_f1 = val_f1
            best_state = cnn.state_dict()
            patience_counter = 0
            torch.save({
                'epoch': epoch, 'model_state_dict': cnn.state_dict(),
                'val_f1': val_f1, 'class_to_idx': class_to_idx,
            }, "ml/reports/real_video/cnn1d_real_video_best.pt")
        else:
            patience_counter += 1
            if patience_counter >= patience:
                print(f"Early stopping at epoch {epoch}")
                break
    
    cnn.load_state_dict(best_state)
    print(f"Best Val Macro-F1: {best_val_f1:.4f}")
    
    # Test evaluation
    cnn.eval()
    test_loss = 0
    test_preds, test_targets = [], []
    with torch.no_grad():
        for data, target in test_loader:
            data, target = data.to(device), target.to(device)
            output = cnn(data)
            loss = criterion(output, target)
            test_loss += loss.item()
            test_preds.extend(output.argmax(1).cpu().numpy())
            test_targets.extend(target.cpu().numpy())
    
    test_f1 = f1_score(test_targets, test_preds, average='macro')
    class_names = [idx_to_class[i] for i in range(len(class_to_idx))]
    
    print(f"\nCNN1D TEST: Loss={test_loss/len(test_loader):.4f}, Macro-F1={test_f1:.4f}")
    print(classification_report(test_targets, test_preds, target_names=class_names, zero_division=0))
    
    # Train GRU
    print("\n=== Training GRU on real video ===")
    gru = GRUClassifier(num_classes=len(class_to_idx)).to(device)
    print(f"Params: {count_parameters(gru):,}")
    
    optimizer = optim.AdamW(gru.parameters(), lr=1e-3, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=60)
    
    best_val_f1 = 0
    best_state = None
    patience_counter = 0
    
    for epoch in range(1, 61):
        gru.train()
        train_loss = 0
        for data, target in train_loader:
            data, target = data.to(device), target.to(device)
            optimizer.zero_grad()
            output = gru(data)
            loss = criterion(output, target)
            loss.backward()
            optimizer.step()
            train_loss += loss.item()
        
        gru.eval()
        val_loss = 0
        val_preds, val_targets = [], []
        with torch.no_grad():
            for data, target in val_loader:
                data, target = data.to(device), target.to(device)
                output = gru(data)
                loss = criterion(output, target)
                val_loss += loss.item()
                val_preds.extend(output.argmax(1).cpu().numpy())
                val_targets.extend(target.cpu().numpy())
        
        val_f1 = f1_score(val_targets, val_preds, average='macro')
        scheduler.step()
        
        print(f"Epoch {epoch:3d}/60 | Train Loss: {train_loss/len(train_loader):.4f} | Val Loss: {val_loss/len(val_loader):.4f} | Val Macro-F1: {val_f1:.4f}")
        
        if val_f1 > best_val_f1:
            best_val_f1 = val_f1
            best_state = gru.state_dict()
            patience_counter = 0
            torch.save({
                'epoch': epoch, 'model_state_dict': gru.state_dict(),
                'val_f1': val_f1, 'class_to_idx': class_to_idx,
            }, "ml/reports/real_video/gru_real_video_best.pt")
        else:
            patience_counter += 1
            if patience_counter >= patience:
                print(f"Early stopping at epoch {epoch}")
                break
    
    gru.load_state_dict(best_state)
    print(f"Best Val Macro-F1: {best_val_f1:.4f}")
    
    # Test evaluation
    gru.eval()
    test_loss = 0
    test_preds, test_targets = [], []
    with torch.no_grad():
        for data, target in test_loader:
            data, target = data.to(device), target.to(device)
            output = gru(data)
            loss = criterion(output, target)
            test_loss += loss.item()
            test_preds.extend(output.argmax(1).cpu().numpy())
            test_targets.extend(target.cpu().numpy())
    
    test_f1 = f1_score(test_targets, test_preds, average='macro')
    print(f"\nGRU TEST: Loss={test_loss/len(test_loader):.4f}, Macro-F1={test_f1:.4f}")
    print(classification_report(test_targets, test_preds, target_names=class_names, zero_division=0))
    
    # Export to ONNX
    print("\n=== Exporting to ONNX ===")
    from src.pq_ml.models import export_to_onnx
    cnn.to('cpu')
    gru.to('cpu')
    export_to_onnx(cnn, (1, 48, 132), "ml/models/cnn1d_real_video_int8.onnx")
    export_to_onnx(gru, (1, 48, 132), "ml/models/gru_real_video_int8.onnx")
    print("ONNX export complete")

if __name__ == "__main__":
    main()