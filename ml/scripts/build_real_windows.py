#!/usr/bin/env python3
"""R1: Build training windows from REAL GIF keypoints (no synthetic data)."""
import json
import numpy as np
import torch
from torch.utils.data import Dataset
from pathlib import Path
from typing import List, Dict, Tuple, Optional
import yaml
import random
from scipy.ndimage import gaussian_filter1d
from scipy.signal import find_peaks
from scipy.fft import fft

# ── Load configs ────────────────────────────────────────────────────────────
with open("configs/augmentation.yaml") as f:
    AUG_CONFIG = yaml.safe_load(f)

with open("configs/taxonomy_v1.yaml") as f:
    TAXONOMY = yaml.safe_load(f)

# Pattern -> class mapping
pattern_to_class = {}
for cls in TAXONOMY["classes"]:
    for pattern in cls["includes"]:
        pattern_to_class[pattern] = cls["name"]

# Load splits
import pandas as pd
splits_df = pd.read_csv("data/manifests/splits_v1.csv")

# Load combined manifest (has frame-level keypoint info)
with open("data/manifests/combined_manifest.json") as f:
    gif_manifest = json.load(f)

# Load exercise_ml_map for primary joints
with open("data/exercise_ml_map.json") as f:
    ml_map = json.load(f)

# Primary joint triplets per pattern (from exercise_ml_map rep_signal)
pattern_primary_joints = {}
for ex_id, entry in ml_map.items():
    pattern = entry.get("movement_pattern", "unknown")
    if "rep_signal" in entry and "primary_joints" in entry["rep_signal"]:
        # Convert joint names to landmark indices
        joint_names = entry["rep_signal"]["primary_joints"]
        name_to_idx = {
            "nose": 0, "left_eye": 1, "right_eye": 2, "left_ear": 3, "right_ear": 4,
            "left_shoulder": 11, "right_shoulder": 12,
            "left_elbow": 13, "right_elbow": 14,
            "left_wrist": 15, "right_wrist": 16,
            "left_hip": 23, "right_hip": 24,
            "left_knee": 25, "right_knee": 26,
            "left_ankle": 27, "right_ankle": 28,
        }
        indices = [name_to_idx.get(n, 0) for n in joint_names]
        if len(indices) >= 3:
            pattern_primary_joints[pattern] = indices[:3]

# Fill in missing patterns with defaults
defaults = {
    "squat": [24, 26, 28], "lunge": [24, 26, 28],
    "curl": [12, 14, 16], "horizontal_push": [12, 14, 16],
    "vertical_push": [12, 14, 16], "horizontal_pull": [12, 14, 16],
    "vertical_pull": [12, 14, 16], "triceps_extension": [12, 14, 16],
    "lateral_raise": [12, 14, 16], "front_raise": [12, 14, 16],
    "rear_delt": [12, 14, 16], "hinge": [24, 26, 28],
    "hip_thrust_bridge": [24, 26, 28], "calf_raise": [24, 26, 28],
    "core_flexion": [11, 23, 25], "rotation": [11, 23, 25],
    "core_isometric": [11, 23, 25], "cardio_dynamic": [24, 26, 28],
    "carry_locomotion": [24, 26, 28],
}
for p, idx in defaults.items():
    if p not in pattern_primary_joints:
        pattern_primary_joints[p] = idx

WINDOW_SIZE = 48
STRIDE = 24
TARGET_FPS = 15
PAD_FACTOR = 1.5
OFFSET = (PAD_FACTOR - 1) / 2  # 0.25

# ── Keypoint loading from GIFs ──────────────────────────────────────────────
def load_gif_frames(gif_path: Path):
    from PIL import Image, ImageSequence
    frames = []
    with Image.open(gif_path) as gif:
        for f in ImageSequence.Iterator(gif):
            rgba = f.convert("RGBA")
            bg = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
            frames.append(Image.alpha_composite(bg, rgba).convert("RGB"))
    return frames

def pad_image(im, factor=PAD_FACTOR):
    from PIL import Image
    w, h = im.size
    corner_color = im.getpixel((0, 0))
    canvas = Image.new("RGB", (int(w * factor), int(h * factor)), corner_color)
    offset_x = int(w * (factor - 1) / 2)
    offset_y = int(h * (factor - 1) / 2)
    canvas.paste(im, (offset_x, offset_y))
    return canvas

def extract_keypoints_from_pil(pil_rgb, detector):
    import mediapipe as mp
    arr = np.ascontiguousarray(np.asarray(pil_rgb, dtype=np.uint8))
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=arr)
    try:
        detection = detector.detect(mp_image)
    except:
        return None
    if not detection or not detection.pose_landmarks:
        return None
    landmarks = detection.pose_landmarks[0] if isinstance(detection.pose_landmarks, list) else detection.pose_landmarks
    if not landmarks:
        return None
    kps = np.array([[l.x, l.y, l.z, l.visibility] for l in landmarks], dtype=np.float32)
    # Unpad
    kps[:, 0] = kps[:, 0] * PAD_FACTOR - OFFSET
    kps[:, 1] = kps[:, 1] * PAD_FACTOR - OFFSET
    kps[:, 2] = kps[:, 2] * PAD_FACTOR
    # Normalize
    hip = kps[[23, 24]]; mid_hip = (hip[0] + hip[1]) / 2
    shoulder = kps[[11, 12]]; mid_shoulder = (shoulder[0] + shoulder[1]) / 2
    kps_centered = kps - mid_hip
    torso_vec = mid_hip[:2] - mid_shoulder[:2]
    torso_len = np.hypot(torso_vec[0], torso_vec[1]) + 1e-6
    kps_norm = (kps_centered / torso_len).astype(np.float32)
    return kps_norm

def get_detector():
    import mediapipe as mp
    from mediapipe.tasks import python as mp_python
    from mediapipe.tasks.python import vision
    MODEL_PATH = "models/pose_landmarker_lite.task"
    base_options = mp.tasks.BaseOptions(model_asset_path=str(MODEL_PATH), delegate=mp.tasks.BaseOptions.Delegate.CPU)
    options = vision.PoseLandmarkerOptions(
        base_options=base_options,
        running_mode=vision.RunningMode.IMAGE,
        min_pose_detection_confidence=0.3,
        min_pose_presence_confidence=0.3,
        min_tracking_confidence=0.3,
        num_poses=1,
        output_segmentation_masks=False,
    )
    return vision.PoseLandmarker.create_from_options(options)

# ── Build full sequence from GIF ────────────────────────────────────────────
def build_gif_sequence(entry, detector):
    """Extract full keypoint sequence from a GIF, resample to 15 FPS."""
    gif_path = Path(entry["file_path"])
    if not gif_path.exists():
        return None
    
    frames = load_gif_frames(gif_path)
    if not frames:
        return None
    
    # Extract keypoints for each frame with timestamps
    frames_by_ts = {}
    for i, frame in enumerate(frames):
        t = i / len(frames) * (len(frames) / TARGET_FPS)
        padded = pad_image(frame)
        kps = extract_keypoints_from_pil(padded, detector)
        if kps is not None:
            frames_by_ts[t] = kps
    
    if len(frames_by_ts) < 5:
        return None
    
    # Resample to 15 FPS
    timestamps = sorted(frames_by_ts.keys())
    kps_array = np.array([frames_by_ts[t] for t in timestamps])
    t_orig = np.array(timestamps)
    duration = t_orig[-1] - t_orig[0]
    num_frames = max(1, int(round(duration * TARGET_FPS)))
    t_new = np.linspace(t_orig[0], t_orig[-1], num_frames)
    
    resampled = np.empty((num_frames, 33, 4), dtype=np.float32)
    for joint in range(33):
        for coord in range(4):
            resampled[:, joint, coord] = np.interp(t_new, t_orig, kps_array[:, joint, coord])
    
    return resampled  # (N, 33, 4)

# ── Tiling to 48 frames ─────────────────────────────────────────────────────
def tile_to_48(seq):
    """Tile a sequence to exactly 48 frames with smooth seam."""
    if seq.shape[0] >= WINDOW_SIZE:
        # Just take first window
        return seq[:WINDOW_SIZE]
    
    # Tile the sequence
    n = seq.shape[0]
    n_repeats = int(np.ceil(WINDOW_SIZE / n))
    tiled = np.tile(seq, (n_repeats, 1, 1))[:WINDOW_SIZE]
    
    # Smooth the seam between last and first frame of the tile
    # Simple linear blend over 2 frames at seam
    seam_idx = n
    if seam_idx < WINDOW_SIZE:
        # Blend frames at seam_idx-1, seam_idx
        alpha = 0.5
        tiled[seam_idx - 1] = tiled[seam_idx - 1] * alpha + tiled[seam_idx] * (1 - alpha)
        tiled[seam_idx] = tiled[seam_idx] * alpha + tiled[seam_idx - 1] * (1 - alpha)
    
    return tiled[:WINDOW_SIZE]

# ── Augmentation functions ──────────────────────────────────────────────────
def augment_window(window):
    """Apply augmentations to a (48, 33, 4) window."""
    w = window.copy()
    
    # Mirror (50%)
    if AUG_CONFIG["mirror"]["enabled"] and random.random() < AUG_CONFIG["mirror"]["probability"]:
        swap_pairs = AUG_CONFIG["mirror"]["swap_pairs"]
        for a, b in swap_pairs:
            w[:, [a, b]] = w[:, [b, a]]
        w[:, :, 0] = -w[:, :, 0]
    
    # Rotation (50%)
    if AUG_CONFIG["rotation"]["enabled"] and random.random() < AUG_CONFIG["rotation"]["probability"]:
        max_deg = AUG_CONFIG["rotation"]["max_degrees"]
        angle = random.uniform(-max_deg, max_deg) * np.pi / 180
        cos_a, sin_a = np.cos(angle), np.sin(angle)
        x, y = w[:, :, 0].copy(), w[:, :, 1].copy()
        w[:, :, 0] = x * cos_a - y * sin_a
        w[:, :, 1] = x * sin_a + y * cos_a
    
    # Scale (50%)
    if AUG_CONFIG["scale"]["enabled"] and random.random() < AUG_CONFIG["scale"]["probability"]:
        factor = random.uniform(AUG_CONFIG["scale"]["min_factor"], AUG_CONFIG["scale"]["max_factor"])
        w[:, :, :3] *= factor
    
    # Translation (50%)
    if AUG_CONFIG["translation"]["enabled"] and random.random() < AUG_CONFIG["translation"]["probability"]:
        max_frac = AUG_CONFIG["translation"]["max_fraction"]
        w[:, :, 0] += random.uniform(-max_frac, max_frac)
        w[:, :, 1] += random.uniform(-max_frac, max_frac)
    
    # Landmark noise (50%)
    if AUG_CONFIG["landmark_noise"]["enabled"] and random.random() < AUG_CONFIG["landmark_noise"]["probability"]:
        noise = np.random.normal(0, AUG_CONFIG["landmark_noise"]["std"], w[:, :, :3].shape).astype(np.float32)
        w[:, :, :3] += noise
    
    # Joint dropout (30%)
    if AUG_CONFIG["joint_dropout"]["enabled"] and random.random() < AUG_CONFIG["joint_dropout"]["probability"]:
        max_j = AUG_CONFIG["joint_dropout"]["max_joints"]
        n_drop = random.randint(1, max_j)
        drop_idx = random.sample(range(33), n_drop)
        w[:, drop_idx, :] = 0
    
    # Visibility drop (30%)
    if AUG_CONFIG["visibility_drop"]["enabled"] and random.random() < AUG_CONFIG["visibility_drop"]["probability"]:
        max_j = AUG_CONFIG["visibility_drop"]["max_joints"]
        min_vis = AUG_CONFIG["visibility_drop"]["min_visibility"]
        n_drop = random.randint(1, max_j)
        drop_idx = random.sample(range(33), n_drop)
        w[:, drop_idx, 3] = min_vis
    
    # Speed variation (50%)
    if AUG_CONFIG["speed"]["enabled"] and random.random() < AUG_CONFIG["speed"]["probability"]:
        factor = random.uniform(AUG_CONFIG["speed"]["min_factor"], AUG_CONFIG["speed"]["max_factor"])
        orig_len = w.shape[0]
        new_len = max(16, int(orig_len * factor))
        t_orig = np.linspace(0, 1, orig_len)
        t_new = np.linspace(0, 1, new_len)
        res = np.empty((new_len, 33, 4), dtype=np.float32)
        for j in range(33):
            for c in range(4):
                res[:, j, c] = np.interp(t_new, t_orig, w[:, j, c])
        # Resize back to 48
        t_back = np.linspace(0, 1, WINDOW_SIZE)
        final = np.empty((WINDOW_SIZE, 33, 4), dtype=np.float32)
        for j in range(33):
            for c in range(4):
                final[:, j, c] = np.interp(t_back, np.linspace(0, 1, new_len), res[:, j, c])
        w = final
    
    # Temporal crop (50%)
    if AUG_CONFIG["temporal_crop"]["enabled"] and random.random() < AUG_CONFIG["temporal_crop"]["probability"]:
        max_frac = AUG_CONFIG["temporal_crop"]["max_crop_fraction"]
        orig_len = w.shape[0]
        crop_len = int(orig_len * (1 - random.uniform(0, max_frac)))
        if crop_len >= 16:
            start = random.randint(0, orig_len - crop_len)
            cropped = w[start:start + crop_len]
            t_orig = np.linspace(0, 1, crop_len)
            t_new = np.linspace(0, 1, WINDOW_SIZE)
            res = np.empty((WINDOW_SIZE, 33, 4), dtype=np.float32)
            for j in range(33):
                for c in range(4):
                    res[:, j, c] = np.interp(t_new, t_orig, cropped[:, j, c])
            w = res
    
    # Camera yaw (30%)
    if AUG_CONFIG["camera_yaw"]["enabled"] and random.random() < AUG_CONFIG["camera_yaw"]["probability"]:
        max_deg = AUG_CONFIG["camera_yaw"]["max_degrees"]
        angle = random.uniform(-max_deg, max_deg) * np.pi / 180
        cos_a, sin_a = np.cos(angle), np.sin(angle)
        x, z = w[:, :, 0].copy(), w[:, :, 2].copy()
        w[:, :, 0] = x * cos_a + z * sin_a
        w[:, :, 2] = -x * sin_a + z * cos_a
    
    return w

# ── Dataset ─────────────────────────────────────────────────────────────────
class RealGifWindowDataset(Dataset):
    def __init__(self, split: str, augment: bool = True):
        self.split = split
        self.augment = augment and split == "train"
        
        # Get group IDs for this split
        self.group_ids = splits_df[splits_df["split"] == split]["group_id"].tolist()
        
        # Build class mapping
        classes = sorted(splits_df["class"].unique())
        self.class_to_idx = {c: i for i, c in enumerate(classes)}
        self.idx_to_class = {v: k for k, v in self.class_to_idx.items()}
        
        # Load detector once
        self.detector = get_detector()
        
        # Build sequences for each group (cached)
        self.sequences = {}
        print(f"Building sequences for {split} ({len(self.group_ids)} groups)...")
        for gid in self.group_ids:
            entry = next((e for e in gif_manifest if e["exercise_id"] == gid), None)
            if not entry:
                continue
            seq = build_gif_sequence(entry, self.detector)
            if seq is not None and seq.shape[0] >= 5:
                tiled = tile_to_48(seq)
                cls = splits_df[splits_df["group_id"] == gid]["class"].values[0]
                cls_idx = self.class_to_idx[cls]
                self.sequences[gid] = (tiled, cls_idx)
        
        print(f"  Built {len(self.sequences)} sequences")
        
        # Create window samples
        self.samples = []
        for gid, (seq, cls_idx) in self.sequences.items():
            if len(seq) >= WINDOW_SIZE:
                for start in range(0, len(seq) - WINDOW_SIZE + 1, STRIDE):
                    self.samples.append((gid, start, cls_idx))
            else:
                # Pad if needed (shouldn't happen with tiling)
                self.samples.append((gid, 0, cls_idx))
        
        print(f"  {split}: {len(self.samples)} window samples from {len(self.sequences)} exercises")
    
    def __len__(self):
        return len(self.samples)
    
    def __getitem__(self, idx):
        gid, start, cls_idx = self.samples[idx]
        seq, _ = self.sequences[gid]
        
        if start + WINDOW_SIZE <= len(seq):
            window = seq[start:start + WINDOW_SIZE]
        else:
            window = seq[-WINDOW_SIZE:]
        
        if self.augment:
            window = augment_window(window)
        
        # Flatten to (48, 132)
        window_flat = window.reshape(WINDOW_SIZE, -1).astype(np.float32)
        return torch.from_numpy(window_flat), torch.tensor(cls_idx, dtype=torch.long)

# ── Main ────────────────────────────────────────────────────────────────────
def main():
    print("=== R1: Building REAL GIF windows ===")
    
    # Test dataset creation
    train_ds = RealGifWindowDataset("train", augment=True)
    val_ds = RealGifWindowDataset("val", augment=False)
    test_ds = RealGifWindowDataset("test", augment=False)
    
    print(f"\nTrain: {len(train_ds)} windows from {len(train_ds.sequences)} exercises")
    print(f"Val: {len(val_ds)} windows from {len(val_ds.sequences)} exercises")
    print(f"Test: {len(test_ds)} windows from {len(test_ds.sequences)} exercises")
    
    # Test a batch
    from torch.utils.data import DataLoader
    train_loader = DataLoader(train_ds, batch_size=4, shuffle=True)
    batch = next(iter(train_loader))
    x, y = batch
    print(f"\nBatch shape: {x.shape}")  # (B, 48, 132)
    print(f"Labels: {y}")
    print(f"Input range: [{x.min():.3f}, {x.max():.3f}]")
    print(f"Input mean: {x.mean():.3f}, std: {x.std():.3f}")
    
    # Class distribution
    from collections import Counter
    train_labels = [train_ds.idx_to_class[s[2]] for s in train_ds.samples]
    val_labels = [val_ds.idx_to_class[s[2]] for s in val_ds.samples]
    print(f"\nTrain class dist: {Counter(train_labels)}")
    print(f"Val class dist: {Counter(val_labels)}")

if __name__ == "__main__":
    main()