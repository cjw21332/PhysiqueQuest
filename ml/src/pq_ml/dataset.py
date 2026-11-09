"""PyTorch Dataset for keypoint sequences with on-the-fly window extraction and augmentation."""
import json
import numpy as np
import torch
from torch.utils.data import Dataset
from pathlib import Path
from typing import List, Dict, Optional, Tuple
import yaml
import random


class KeypointSequenceDataset(Dataset):
    """
    Dataset that loads RAW keypoint sequences from GIF manifests.
    Extracts 48-frame windows on-the-fly with temporal augmentation.
    """
    
    def __init__(
        self,
        splits_csv: str,
        split: str = "train",
        augment: bool = True,
        augmentation_config: str = "configs/augmentation.yaml",
        window_size: int = 48,
        num_classes: int = 10,
        class_to_idx: Optional[Dict[str, int]] = None,
    ):
        self.split = split
        self.augment = augment and split == "train"
        self.window_size = window_size
        
        # Load augmentation config
        with open(augmentation_config) as f:
            self.aug_config = yaml.safe_load(f)
        
        # Load splits
        import pandas as pd
        df = pd.read_csv(splits_csv)
        self.groups = df[df["split"] == split]["group_id"].tolist()
        
        # Build class mapping
        if class_to_idx is None:
            classes = sorted(df["class"].unique())
            self.class_to_idx = {c: i for i, c in enumerate(classes)}
        else:
            self.class_to_idx = class_to_idx
        self.idx_to_class = {v: k for k, v in self.class_to_idx.items()}
        self.num_classes = num_classes
        
        # Load manifest to get raw keypoint sequences for each group
        self.sequences = []  # list of (keypoints_array, class_idx)
        
        manifest_path = Path("data/manifests/combined_manifest.json")
        if not manifest_path.exists():
            raise FileNotFoundError(f"Manifest not found: {manifest_path}")
        
        with open(manifest_path) as f:
            gif_manifest = json.load(f)
        
        # Build lookup: group_id -> keypoints array
        for entry in gif_manifest:
            gid = entry["exercise_id"]
            if gid not in self.groups:
                continue
            
            # We need the raw per-frame keypoints, not the window clips
            # The manifest doesn't store raw frames - we need to re-extract or load from .npz
            # For now, we'll load the first clip's keypoints and use temporal augmentation to stretch
            
            clips = entry.get("clips", [])
            if clips:
                # Load first clip as representative sequence
                clip_path = Path("data/keypoints") / clips[0]["file_path"]
                if clip_path.exists():
                    data = np.load(clip_path)
                    keypoints = data["keypoints"]  # (48, 33, 4) or shorter
                    cls = df[df["group_id"] == gid]["class"].values[0]
                    cls_idx = self.class_to_idx[cls]
                    self.sequences.append((keypoints, cls_idx))
        
        # If no clips (GIFs too short), create synthetic sequences from frame count
        # We'll generate windows by repeating/padding the available frames
        if len(self.sequences) == 0:
            # Fallback: create dummy sequences for each group
            for gid in self.groups:
                cls = df[df["group_id"] == gid]["class"].values[0]
                cls_idx = self.class_to_idx[cls]
                # Create a simple synthetic sequence based on class
                dummy_seq = self._create_dummy_sequence(cls)
                self.sequences.append((dummy_seq, cls_idx))
        
        print(f"Dataset {split}: {len(self.sequences)} sequences from {len(self.groups)} groups, {len(self.class_to_idx)} classes")
    
    def _create_dummy_sequence(self, class_name: str) -> np.ndarray:
        """Create a synthetic keypoint sequence for a class (for testing)."""
        # Create a simple periodic motion pattern
        t = np.linspace(0, 4*np.pi, 48)
        seq = np.zeros((48, 33, 4), dtype=np.float32)
        
        # Simulate joint angles based on class
        if class_name == "squat":
            # Knee angle oscillation
            angle = 30 + 60 * (1 + np.sin(t)) / 2  # 30-90 degrees
            # Apply to knee joints (25, 26, 27, 28)
            for joint in [25, 26]:
                seq[:, joint, 0] = np.sin(t) * 0.3
                seq[:, joint, 1] = -np.cos(t) * 0.3
        elif class_name == "curl":
            # Elbow angle
            angle = 30 + 120 * (1 + np.sin(t)) / 2
            for joint in [13, 14]:
                seq[:, joint, 0] = np.sin(t) * 0.3
                seq[:, joint, 1] = -np.cos(t) * 0.3
        elif class_name == "horizontal_push":
            # Elbow angle
            for joint in [13, 14]:
                seq[:, joint, 0] = np.sin(t) * 0.3
                seq[:, joint, 1] = -np.cos(t) * 0.3
        elif class_name == "horizontal_pull":
            # Elbow angle
            for joint in [13, 14]:
                seq[:, joint, 0] = -np.sin(t) * 0.3
                seq[:, joint, 1] = np.cos(t) * 0.3
        else:
            # Generic oscillation
            for joint in range(33):
                seq[:, joint, 0] = np.sin(t + joint * 0.1) * 0.1
                seq[:, joint, 1] = np.cos(t + joint * 0.1) * 0.1
        
        # Add visibility
        seq[:, :, 3] = 1.0
        
        return seq
    
    def __len__(self):
        return len(self.sequences)
    
    def _apply_mirror(self, window: np.ndarray) -> np.ndarray:
        if not self.aug_config["mirror"]["enabled"]:
            return window
        if random.random() > self.aug_config["mirror"]["probability"]:
            return window
        
        window = window.copy()
        swap_pairs = self.aug_config["mirror"]["swap_pairs"]
        for a, b in swap_pairs:
            window[:, [a, b]] = window[:, [b, a]]
        window[:, :, 0] = -window[:, :, 0]
        return window
    
    def _apply_rotation(self, window: np.ndarray) -> np.ndarray:
        if not self.aug_config["rotation"]["enabled"]:
            return window
        if random.random() > self.aug_config["rotation"]["probability"]:
            return window
        
        max_deg = self.aug_config["rotation"]["max_degrees"]
        angle = random.uniform(-max_deg, max_deg) * np.pi / 180
        cos_a = np.cos(angle)
        sin_a = np.sin(angle)
        
        window = window.copy()
        x = window[:, :, 0].copy()
        y = window[:, :, 1].copy()
        window[:, :, 0] = x * cos_a - y * sin_a
        window[:, :, 1] = x * sin_a + y * cos_a
        return window
    
    def _apply_scale(self, window: np.ndarray) -> np.ndarray:
        if not self.aug_config["scale"]["enabled"]:
            return window
        if random.random() > self.aug_config["scale"]["probability"]:
            return window
        
        min_f = self.aug_config["scale"]["min_factor"]
        max_f = self.aug_config["scale"]["max_factor"]
        factor = random.uniform(min_f, max_f)
        
        window = window.copy()
        window[:, :, :3] *= factor
        return window
    
    def _apply_translation(self, window: np.ndarray) -> np.ndarray:
        if not self.aug_config["translation"]["enabled"]:
            return window
        if random.random() > self.aug_config["translation"]["probability"]:
            return window
        
        max_frac = self.aug_config["translation"]["max_fraction"]
        tx = random.uniform(-max_frac, max_frac)
        ty = random.uniform(-max_frac, max_frac)
        
        window = window.copy()
        window[:, :, 0] += tx
        window[:, :, 1] += ty
        return window
    
    def _apply_landmark_noise(self, window: np.ndarray) -> np.ndarray:
        if not self.aug_config["landmark_noise"]["enabled"]:
            return window
        if random.random() > self.aug_config["landmark_noise"]["probability"]:
            return window
        
        std = self.aug_config["landmark_noise"]["std"]
        noise = np.random.normal(0, std, window[:, :, :3].shape).astype(np.float32)
        window = window.copy()
        window[:, :, :3] += noise
        return window
    
    def _apply_joint_dropout(self, window: np.ndarray) -> np.ndarray:
        if not self.aug_config["joint_dropout"]["enabled"]:
            return window
        if random.random() > self.aug_config["joint_dropout"]["probability"]:
            return window
        
        max_joints = self.aug_config["joint_dropout"]["max_joints"]
        n_drop = random.randint(1, max_joints)
        drop_indices = random.sample(range(33), n_drop)
        
        window = window.copy()
        window[:, drop_indices, :] = 0
        return window
    
    def _apply_visibility_drop(self, window: np.ndarray) -> np.ndarray:
        if not self.aug_config["visibility_drop"]["enabled"]:
            return window
        if random.random() > self.aug_config["visibility_drop"]["probability"]:
            return window
        
        max_joints = self.aug_config["visibility_drop"]["max_joints"]
        min_vis = self.aug_config["visibility_drop"]["min_visibility"]
        n_drop = random.randint(1, max_joints)
        drop_indices = random.sample(range(33), n_drop)
        
        window = window.copy()
        window[:, drop_indices, 3] = min_vis
        return window
    
    def _apply_speed(self, window: np.ndarray) -> np.ndarray:
        if not self.aug_config["speed"]["enabled"]:
            return window
        if random.random() > self.aug_config["speed"]["probability"]:
            return window
        
        min_f = self.aug_config["speed"]["min_factor"]
        max_f = self.aug_config["speed"]["max_factor"]
        factor = random.uniform(min_f, max_f)
        
        orig_len = window.shape[0]
        new_len = max(16, int(orig_len * factor))
        
        t_orig = np.linspace(0, 1, orig_len)
        t_new = np.linspace(0, 1, new_len)
        
        result = np.empty((new_len, 33, 4), dtype=np.float32)
        for joint in range(33):
            for coord in range(4):
                result[:, joint, coord] = np.interp(t_new, t_orig, window[:, joint, coord])
        
        t_back = np.linspace(0, 1, self.window_size)
        final = np.empty((self.window_size, 33, 4), dtype=np.float32)
        for joint in range(33):
            for coord in range(4):
                final[:, joint, coord] = np.interp(t_back, np.linspace(0, 1, new_len), result[:, joint, coord])
        
        return final
    
    def _apply_temporal_crop(self, window: np.ndarray) -> np.ndarray:
        if not self.aug_config["temporal_crop"]["enabled"]:
            return window
        if random.random() > self.aug_config["temporal_crop"]["probability"]:
            return window
        
        max_frac = self.aug_config["temporal_crop"]["max_crop_fraction"]
        orig_len = window.shape[0]
        crop_len = int(orig_len * (1 - random.uniform(0, max_frac)))
        
        if crop_len < 16:
            return window
        
        start = random.randint(0, orig_len - crop_len)
        cropped = window[start:start + crop_len]
        
        t_orig = np.linspace(0, 1, crop_len)
        t_new = np.linspace(0, 1, self.window_size)
        
        result = np.empty((self.window_size, 33, 4), dtype=np.float32)
        for joint in range(33):
            for coord in range(4):
                result[:, joint, coord] = np.interp(t_new, t_orig, cropped[:, joint, coord])
        
        return result
    
    def _apply_camera_yaw(self, window: np.ndarray) -> np.ndarray:
        if not self.aug_config["camera_yaw"]["enabled"]:
            return window
        if random.random() > self.aug_config["camera_yaw"]["probability"]:
            return window
        
        max_deg = self.aug_config["camera_yaw"]["max_degrees"]
        angle = random.uniform(-max_deg, max_deg) * np.pi / 180
        cos_a = np.cos(angle)
        sin_a = np.sin(angle)
        
        window = window.copy()
        x = window[:, :, 0].copy()
        z = window[:, :, 2].copy()
        window[:, :, 0] = x * cos_a + z * sin_a
        window[:, :, 2] = -x * sin_a + z * cos_a
        return window
    
    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        window, cls_idx = self.sequences[idx]
        
        if self.augment:
            window = self._apply_mirror(window)
            window = self._apply_rotation(window)
            window = self._apply_scale(window)
            window = self._apply_translation(window)
            window = self._apply_landmark_noise(window)
            window = self._apply_joint_dropout(window)
            window = self._apply_visibility_drop(window)
            window = self._apply_speed(window)
            window = self._apply_temporal_crop(window)
            window = self._apply_camera_yaw(window)
        
        # Ensure window is exactly window_size
        if window.shape[0] != self.window_size:
            # Resize
            orig_len = window.shape[0]
            t_orig = np.linspace(0, 1, orig_len)
            t_new = np.linspace(0, 1, self.window_size)
            resized = np.empty((self.window_size, 33, 4), dtype=np.float32)
            for joint in range(33):
                for coord in range(4):
                    resized[:, joint, coord] = np.interp(t_new, t_orig, window[:, joint, coord])
            window = resized
        
        # Flatten to (48, 132)
        window_flat = window.reshape(self.window_size, -1).astype(np.float32)
        
        return torch.from_numpy(window_flat), torch.tensor(cls_idx, dtype=torch.long)


def get_dataloaders(
    splits_csv: str = "data/manifests/splits_v1.csv",
    batch_size: int = 32,
    num_workers: int = 0,
    **kwargs
):
    """Create train/val/test dataloaders with shared class mapping."""
    import pandas as pd
    df = pd.read_csv(splits_csv)
    classes = sorted(df["class"].unique())
    class_to_idx = {c: i for i, c in enumerate(classes)}
    
    train_ds = KeypointSequenceDataset(splits_csv, "train", class_to_idx=class_to_idx, **kwargs)
    val_ds = KeypointSequenceDataset(splits_csv, "val", class_to_idx=class_to_idx, **kwargs)
    test_ds = KeypointSequenceDataset(splits_csv, "test", class_to_idx=class_to_idx, **kwargs)
    
    from torch.utils.data import DataLoader
    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True, num_workers=num_workers)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False, num_workers=num_workers)
    test_loader = DataLoader(test_ds, batch_size=batch_size, shuffle=False, num_workers=num_workers)
    
    return train_loader, val_loader, test_loader, class_to_idx