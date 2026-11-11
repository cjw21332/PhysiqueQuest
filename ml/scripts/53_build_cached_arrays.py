#!/usr/bin/env python3
"""R1-R2: Build cached arrays from extracted keypoints, then train."""
import json
import numpy as np
import torch
from torch.utils.data import Dataset, DataLoader
import pandas as pd
from pathlib import Path
from typing import Optional
from collections import Counter
from sklearn.metrics import classification_report, confusion_matrix, f1_score
from sklearn.neighbors import KNeighborsClassifier
from sklearn.preprocessing import StandardScaler
import time
import copy

# ── Load configs ────────────────────────────────────────────────────────────
import yaml
with open("configs/taxonomy_v1.yaml") as f:
    TAXONOMY = yaml.safe_load(f)

with open("configs/augmentation.yaml") as f:
    AUG_CONFIG = yaml.safe_load(f)

# Pattern -> class mapping
pattern_to_class = {}
for cls in TAXONOMY["classes"]:
    for pattern in cls["includes"]:
        pattern_to_class[pattern] = cls["name"]

# Load splits
splits_df = pd.read_csv("data/manifests/splits_v1.csv")

# Load exercise_ml_map
with open("data/exercise_ml_map.json") as f:
    ml_map = json.load(f)

# Load combined manifest for pattern lookup
with open("data/manifests/combined_manifest.json") as f:
    gif_manifest = json.load(f)

# Build exercise_id -> pattern lookup
ex_id_to_pattern = {e["exercise_id"]: e["pattern"] for e in gif_manifest}

# Load cached keypoints
CACHE_DIR = Path("data/keypoints_cached")

WINDOW_SIZE = 48
STRIDE = 24
TARGET_FPS = 15

# ── Augmentation functions (numpy) ──────────────────────────────────────────
def augment_window_np(window):
    """Apply augmentations to (48, 33, 4) window."""
    w = window.copy()
    
    # Mirror
    if AUG_CONFIG["mirror"]["enabled"] and np.random.random() < AUG_CONFIG["mirror"]["probability"]:
        swap_pairs = AUG_CONFIG["mirror"]["swap_pairs"]
        for a, b in swap_pairs:
            w[:, [a, b]] = w[:, [b, a]]
        w[:, :, 0] = -w[:, :, 0]
    
    # Rotation
    if AUG_CONFIG["rotation"]["enabled"] and np.random.random() < AUG_CONFIG["rotation"]["probability"]:
        max_deg = AUG_CONFIG["rotation"]["max_degrees"]
        angle = np.random.uniform(-max_deg, max_deg) * np.pi / 180
        cos_a, sin_a = np.cos(angle), np.sin(angle)
        x, y = w[:, :, 0].copy(), w[:, :, 1].copy()
        w[:, :, 0] = x * cos_a - y * sin_a
        w[:, :, 1] = x * sin_a + y * cos_a
    
    # Scale
    if AUG_CONFIG["scale"]["enabled"] and np.random.random() < AUG_CONFIG["scale"]["probability"]:
        factor = np.random.uniform(AUG_CONFIG["scale"]["min_factor"], AUG_CONFIG["scale"]["max_factor"])
        w[:, :, :3] *= factor
    
    # Translation
    if AUG_CONFIG["translation"]["enabled"] and np.random.random() < AUG_CONFIG["translation"]["probability"]:
        max_frac = AUG_CONFIG["translation"]["max_fraction"]
        w[:, :, 0] += np.random.uniform(-max_frac, max_frac)
        w[:, :, 1] += np.random.uniform(-max_frac, max_frac)
    
    # Landmark noise
    if AUG_CONFIG["landmark_noise"]["enabled"] and np.random.random() < AUG_CONFIG["landmark_noise"]["probability"]:
        noise = np.random.normal(0, AUG_CONFIG["landmark_noise"]["std"], w[:, :, :3].shape).astype(np.float32)
        w[:, :, :3] += noise
    
    # Joint dropout
    if AUG_CONFIG["joint_dropout"]["enabled"] and np.random.random() < AUG_CONFIG["joint_dropout"]["probability"]:
        max_j = AUG_CONFIG["joint_dropout"]["max_joints"]
        n_drop = np.random.randint(1, max_j + 1)
        drop_idx = np.random.choice(33, n_drop, replace=False)
        w[:, drop_idx, :] = 0
    
    # Visibility drop
    if AUG_CONFIG["visibility_drop"]["enabled"] and np.random.random() < AUG_CONFIG["visibility_drop"]["probability"]:
        max_j = AUG_CONFIG["visibility_drop"]["max_joints"]
        min_vis = AUG_CONFIG["visibility_drop"]["min_visibility"]
        n_drop = np.random.randint(1, max_j + 1)
        drop_idx = np.random.choice(33, n_drop, replace=False)
        w[:, drop_idx, 3] = min_vis
    
    # Speed variation
    if AUG_CONFIG["speed"]["enabled"] and np.random.random() < AUG_CONFIG["speed"]["probability"]:
        factor = np.random.uniform(AUG_CONFIG["speed"]["min_factor"], AUG_CONFIG["speed"]["max_factor"])
        orig_len = w.shape[0]
        new_len = max(16, int(orig_len * factor))
        t_orig = np.linspace(0, 1, orig_len)
        t_new = np.linspace(0, 1, new_len)
        res = np.empty((new_len, 33, 4), dtype=np.float32)
        for j in range(33):
            for c in range(4):
                res[:, j, c] = np.interp(t_new, t_orig, w[:, j, c])
        t_back = np.linspace(0, 1, WINDOW_SIZE)
        final = np.empty((WINDOW_SIZE, 33, 4), dtype=np.float32)
        for j in range(33):
            for c in range(4):
                final[:, j, c] = np.interp(t_back, np.linspace(0, 1, new_len), res[:, j, c])
        w = final
    
    # Temporal crop
    if AUG_CONFIG["temporal_crop"]["enabled"] and np.random.random() < AUG_CONFIG["temporal_crop"]["probability"]:
        max_frac = AUG_CONFIG["temporal_crop"]["max_crop_fraction"]
        orig_len = w.shape[0]
        crop_len = int(orig_len * (1 - np.random.uniform(0, max_frac)))
        if crop_len >= 16:
            start = np.random.randint(0, orig_len - crop_len)
            cropped = w[start:start + crop_len]
            t_orig = np.linspace(0, 1, crop_len)
            t_new = np.linspace(0, 1, WINDOW_SIZE)
            res = np.empty((WINDOW_SIZE, 33, 4), dtype=np.float32)
            for j in range(33):
                for c in range(4):
                    res[:, j, c] = np.interp(t_new, t_orig, cropped[:, j, c])
            w = res
    
    # Camera yaw
    if AUG_CONFIG["camera_yaw"]["enabled"] and np.random.random() < AUG_CONFIG["camera_yaw"]["probability"]:
        max_deg = AUG_CONFIG["camera_yaw"]["max_degrees"]
        angle = np.random.uniform(-max_deg, max_deg) * np.pi / 180
        cos_a, sin_a = np.cos(angle), np.sin(angle)
        x, z = w[:, :, 0].copy(), w[:, :, 2].copy()
        w[:, :, 0] = x * cos_a + z * sin_a
        w[:, :, 2] = -x * sin_a + z * cos_a
    
    return w

# ── Load cached sequence ────────────────────────────────────────────────────
def load_cached_sequence(exercise_id: str) -> Optional[np.ndarray]:
    """Load cached landmarks, tile to 48 frames if needed."""
    cache_path = CACHE_DIR / f"{exercise_id}.npz"
    if not cache_path.exists():
        return None
    
    data = np.load(cache_path)
    landmarks = data["landmarks"]  # (T, 33, 4)
    detection_mask = data.get("detection_mask", np.ones(landmarks.shape[0], dtype=bool))
    
    # Only use frames with detection
    valid = landmarks[detection_mask.astype(bool)]
    if len(valid) < 5:
        return None
    
    # Tile to 48 frames
    if len(valid) >= WINDOW_SIZE:
        return valid[:WINDOW_SIZE]
    
    # Tile with smooth seam
    n = len(valid)
    n_repeats = int(np.ceil(WINDOW_SIZE / n))
    tiled = np.tile(valid, (n_repeats, 1, 1))[:WINDOW_SIZE]
    
    # Smooth seam
    seam_idx = n
    if seam_idx < WINDOW_SIZE:
        alpha = 0.5
        tiled[seam_idx - 1] = tiled[seam_idx - 1] * alpha + tiled[seam_idx] * (1 - alpha)
        tiled[seam_idx] = tiled[seam_idx] * alpha + tiled[seam_idx - 1] * (1 - alpha)
    
    return tiled[:WINDOW_SIZE]

# ── Build all arrays ────────────────────────────────────────────────────────
def build_arrays(split: str):
    """Build X, y arrays for a split."""
    group_ids = splits_df[splits_df["split"] == split]["group_id"].tolist()
    
    # Class mapping
    classes = sorted(splits_df["class"].unique())
    class_to_idx = {c: i for i, c in enumerate(classes)}
    
    X_list, y_list = [], []
    
    for gid in group_ids:
        pattern = ex_id_to_pattern.get(gid, "unknown")
        if pattern not in pattern_to_class:
            continue
        cls = pattern_to_class[pattern]
        cls_idx = class_to_idx[cls]
        
        seq = load_cached_sequence(gid)
        if seq is None:
            continue
        
        # Create windows with stride
        if len(seq) >= WINDOW_SIZE:
            for start in range(0, len(seq) - WINDOW_SIZE + 1, STRIDE):
                window = seq[start:start + WINDOW_SIZE]
                X_list.append(window)
                y_list.append(cls_idx)
        else:
            X_list.append(seq)
            y_list.append(cls_idx)
    
    if not X_list:
        return np.empty((0, WINDOW_SIZE, 132)), np.empty((0,)), class_to_idx
    
    X = np.array(X_list)  # (N, 48, 33, 4)
    X_flat = X.reshape(len(X_list), WINDOW_SIZE, -1)  # (N, 48, 132)
    y = np.array(y_list)
    
    return X_flat, y, class_to_idx


# ── PyTorch Dataset from arrays ─────────────────────────────────────────────
class CachedArrayDataset(Dataset):
    def __init__(self, X, y, augment: bool = False):
        self.X = X  # (N, 48, 132)
        self.y = y
        self.augment = augment
    
    def __len__(self):
        return len(self.X)
    
    def __getitem__(self, idx):
        x = self.X[idx]
        y = self.y[idx]
        
        if self.augment:
            # Reshape for augmentation
            window = x.reshape(WINDOW_SIZE, 33, 4)
            window = augment_window_np(window)
            x = window.reshape(WINDOW_SIZE, -1)
        
        return torch.from_numpy(x.astype(np.float32)), torch.tensor(y, dtype=torch.long)


def main():
    print("=== Building cached arrays ===")
    start = time.time()
    
    # Build arrays for all splits
    X_train, y_train, class_to_idx = build_arrays("train")
    X_val, y_val, _ = build_arrays("val")
    X_test, y_test, _ = build_arrays("test")
    
    elapsed = time.time() - start
    print(f"Built arrays in {elapsed:.1f}s")
    print(f"Train: {X_train.shape}, Val: {X_val.shape}, Test: {X_test.shape}")
    
    # Save arrays
    np.save("data/windows/train_X.npy", X_train)
    np.save("data/windows/train_y.npy", y_train)
    np.save("data/windows/val_X.npy", X_val)
    np.save("data/windows/val_y.npy", y_val)
    np.save("data/windows/test_X.npy", X_test)
    np.save("data/windows/test_y.npy", y_test)
    
    # Class distribution
    idx_to_class = {v: k for k, v in class_to_idx.items()}
    train_labels = [idx_to_class[i] for i in y_train]
    val_labels = [idx_to_class[i] for i in y_val]
    test_labels = [idx_to_class[i] for i in y_test]
    
    print(f"\nTrain ({len(X_train)}): {Counter(train_labels)}")
    print(f"Val ({len(X_val)}): {Counter(val_labels)}")
    print(f"Test ({len(X_test)}): {Counter(test_labels)}")
    
    # Save class mapping
    with open("data/windows/class_to_idx.json", "w") as f:
        json.dump(class_to_idx, f)
    
    print("\nArrays saved to data/windows/")


if __name__ == "__main__":
    from pathlib import Path
    Path("data/windows").mkdir(parents=True, exist_ok=True)
    main()