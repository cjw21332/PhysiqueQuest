#!/usr/bin/env python3
"""Genuine DTW baseline - optimized version using dtaidistance or fast implementation."""
import numpy as np
from sklearn.metrics import f1_score, classification_report, confusion_matrix
from sklearn.neighbors import KNeighborsClassifier
from sklearn.preprocessing import StandardScaler
from pathlib import Path
import json
import sys
import time

sys.path.insert(0, str(Path(__file__).parent.parent))

# Try to import dtaidistance for fast DTW
try:
    from dtaidistance import dtw
    HAS_DTAI = True
    print("Using dtaidistance for fast DTW")
except ImportError:
    HAS_DTAI = False
    print("dtaidistance not available, using custom implementation")


def compute_joint_angles(keypoints_seq):
    """
    Compute key joint angles from keypoint sequence.
    keypoints_seq: (T, 132) or (T, 33, 4) - x, y, z, visibility
    Returns: (T, num_angles) - angles in radians
    """
    # MediaPipe Pose joint indices
    # 11: left_shoulder, 12: right_shoulder
    # 13: left_elbow, 14: right_elbow
    # 15: left_wrist, 16: right_wrist
    # 23: left_hip, 24: right_hip
    # 25: left_knee, 26: right_knee
    # 27: left_ankle, 28: right_ankle
    
    # Ensure proper shape
    if keypoints_seq.ndim == 2:
        keypoints_seq = keypoints_seq.reshape(keypoints_seq.shape[0], 33, 4)
    
    angles = []
    for t in range(keypoints_seq.shape[0]):
        kp = keypoints_seq[t, :, :3]  # x, y, z
        
        frame_angles = []
        
        # Elbow angles (shoulder-elbow-wrist)
        for side in ['left', 'right']:
            if side == 'left':
                a, b, c = 11, 13, 15  # shoulder, elbow, wrist
            else:
                a, b, c = 12, 14, 16
            
            v1 = kp[a] - kp[b]
            v2 = kp[c] - kp[b]
            cosine = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-8)
            angle = np.arccos(np.clip(cosine, -1, 1))
            frame_angles.append(angle)
        
        # Shoulder angles (elbow-shoulder-hip)
        for side in ['left', 'right']:
            if side == 'left':
                a, b, c = 13, 11, 23
            else:
                a, b, c = 14, 12, 24
            v1 = kp[a] - kp[b]
            v2 = kp[c] - kp[b]
            cosine = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-8)
            angle = np.arccos(np.clip(cosine, -1, 1))
            frame_angles.append(angle)
        
        # Hip angles (shoulder-hip-knee)
        for side in ['left', 'right']:
            if side == 'left':
                a, b, c = 11, 23, 25
            else:
                a, b, c = 12, 24, 26
            v1 = kp[a] - kp[b]
            v2 = kp[c] - kp[b]
            cosine = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-8)
            angle = np.arccos(np.clip(cosine, -1, 1))
            frame_angles.append(angle)
        
        # Knee angles (hip-knee-ankle)
        for side in ['left', 'right']:
            if side == 'left':
                a, b, c = 23, 25, 27
            else:
                a, b, c = 24, 26, 28
            v1 = kp[a] - kp[b]
            v2 = kp[c] - kp[b]
            cosine = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-8)
            angle = np.arccos(np.clip(cosine, -1, 1))
            frame_angles.append(angle)
        
        angles.append(frame_angles)
    
    return np.array(angles)  # (T, 8)


class DTWClassifier:
    """1-NN classifier using DTW distance on angle sequences."""
    
    def __init__(self, max_train_samples=None, radius=5):
        self.max_train_samples = max_train_samples
        self.radius = radius
        self.train_sequences = None
        self.train_labels = None
        self.classes_ = None
    
    def fit(self, X, y):
        """X: list of (T, 33, 4) keypoint sequences, y: labels"""
        # Limit training samples for speed
        if self.max_train_samples and len(X) > self.max_train_samples:
            # Stratified sampling
            from sklearn.utils import resample
            indices = np.arange(len(X))
            sampled_indices = resample(indices, n_samples=self.max_train_samples, 
                                      stratify=y, random_state=42)
            X = X[sampled_indices]
            y = y[sampled_indices]
            print(f"  Subsampled to {len(X)} training samples for DTW")
        
        self.train_sequences = []
        for seq in X:
            angles = compute_joint_angles(seq)
            self.train_sequences.append(angles)
        self.train_labels = np.array(y)
        self.classes_ = np.unique(y)
        return self
    
    def _dtw_distance(self, seq1, seq2):
        """Compute DTW distance with optional dtaidistance."""
        if HAS_DTAI:
            # dtaidistance expects (T,) or (T, D) - it computes multivariate DTW
            try:
                return dtw.distance(seq1, seq2, window=self.radius, use_c=True)
            except:
                pass
        
        # Fallback: custom fast DTW with Sakoe-Chiba band
        T1, D = seq1.shape
        T2, _ = seq2.shape
        
        dtw_mat = np.full((T1 + 1, T2 + 1), np.inf)
        dtw_mat[0, 0] = 0
        
        for i in range(1, T1 + 1):
            j_start = max(1, i - self.radius)
            j_end = min(T2, i + self.radius) + 1
            for j in range(j_start, j_end):
                cost = np.linalg.norm(seq1[i-1] - seq2[j-1])
                dtw_mat[i, j] = cost + min(
                    dtw_mat[i-1, j],
                    dtw_mat[i, j-1],
                    dtw_mat[i-1, j-1]
                )
        
        return dtw_mat[T1, T2]
    
    def predict(self, X):
        """Predict labels for test sequences"""
        preds = []
        for idx, seq in enumerate(X):
            angles = compute_joint_angles(seq)
            min_dist = np.inf
            pred_label = self.train_labels[0]
            
            for i, train_angles in enumerate(self.train_sequences):
                dist = self._dtw_distance(angles, train_angles)
                if dist < min_dist:
                    min_dist = dist
                    pred_label = self.train_labels[i]
            
            preds.append(pred_label)
            
            if (idx + 1) % 20 == 0:
                print(f"  Processed {idx + 1}/{len(X)} test samples")
        
        return np.array(preds)


def load_data():
    """Load train/val/test data"""
    X_train = np.load("data/windows/train_X.npy")
    y_train = np.load("data/windows/train_y.npy")
    X_val = np.load("data/windows/val_X.npy")
    y_val = np.load("data/windows/val_y.npy")
    X_test = np.load("data/windows/test_X.npy")
    y_test = np.load("data/windows/test_y.npy")
    
    with open("data/windows/class_to_idx.json") as f:
        class_to_idx = json.load(f)
    idx_to_class = {v: k for k, v in class_to_idx.items()}
    
    return X_train, y_train, X_val, y_val, X_test, y_test, idx_to_class


def run_dtw_baseline(max_train=300, radius=5):
    """Run DTW baseline evaluation"""
    print(f"\n=== Genuine DTW Baseline (max_train={max_train}, radius={radius}) ===")
    
    X_train, y_train, X_val, y_val, X_test, y_test, idx_to_class = load_data()
    class_names = [idx_to_class[i] for i in range(len(idx_to_class))]
    
    # Train DTW classifier
    print("Computing training angle sequences...")
    dtw_clf = DTWClassifier(max_train_samples=max_train, radius=radius)
    dtw_clf.fit(X_train, y_train)
    
    # Validate
    print("Evaluating on validation set...")
    start = time.time()
    val_preds = dtw_clf.predict(X_val)
    val_f1 = f1_score(y_val, val_preds, average='macro')
    print(f"  Val time: {time.time() - start:.1f}s")
    
    print(f"DTW (angle sequences): Val Macro-F1 = {val_f1:.4f}")
    print(classification_report(y_val, val_preds, target_names=class_names, zero_division=0))
    
    # Test
    print("Evaluating on test set...")
    start = time.time()
    test_preds = dtw_clf.predict(X_test)
    test_f1 = f1_score(y_test, test_preds, average='macro')
    print(f"  Test time: {time.time() - start:.1f}s")
    
    print(f"DTW TEST Macro-F1 = {test_f1:.4f}")
    print(classification_report(y_test, test_preds, target_names=class_names, zero_division=0))
    
    cm = confusion_matrix(y_test, test_preds)
    print("Confusion Matrix:")
    print(cm)
    
    return val_f1, test_f1, val_preds, test_preds


def run_cosine_knn_baseline():
    """Run cosine-kNN baseline for comparison"""
    print("\n=== Cosine-kNN Baseline (mean/std signatures) ===")
    
    X_train, y_train, X_val, y_val, X_test, y_test, idx_to_class = load_data()
    class_names = [idx_to_class[i] for i in range(len(idx_to_class))]
    
    def simple_signature(window):
        kps = window.reshape(48, 33, 4)
        return np.concatenate([kps.mean(axis=0).flatten(), kps.std(axis=0).flatten()])
    
    train_sigs = np.array([simple_signature(X_train[i]) for i in range(len(X_train))])
    val_sigs = np.array([simple_signature(X_val[i]) for i in range(len(X_val))])
    test_sigs = np.array([simple_signature(X_test[i]) for i in range(len(X_test))])
    
    scaler = StandardScaler()
    train_sigs = scaler.fit_transform(train_sigs)
    val_sigs = scaler.transform(val_sigs)
    test_sigs = scaler.transform(test_sigs)
    
    knn = KNeighborsClassifier(n_neighbors=3, metric='cosine')
    knn.fit(train_sigs, y_train)
    
    val_preds = knn.predict(val_sigs)
    val_f1 = f1_score(y_val, val_preds, average='macro')
    print(f"Cosine-kNN Val Macro-F1 = {val_f1:.4f}")
    print(classification_report(y_val, val_preds, target_names=class_names, zero_division=0))
    
    test_preds = knn.predict(test_sigs)
    test_f1 = f1_score(y_test, test_preds, average='macro')
    print(f"Cosine-kNN TEST Macro-F1 = {test_f1:.4f}")
    print(classification_report(y_test, test_preds, target_names=class_names, zero_division=0))
    
    return val_f1, test_f1


if __name__ == "__main__":
    # Run cosine-kNN baseline first (fast)
    cosine_val, cosine_test = run_cosine_knn_baseline()
    
    # Run DTW baseline with limited training samples
    dtw_val, dtw_test, _, _ = run_dtw_baseline(max_train=200, radius=5)
    
    print("\n=== BASELINE COMPARISON ===")
    print(f"DTW (angles, radius=5, 200 train): Val={dtw_val:.4f}, Test={dtw_test:.4f}")
    print(f"Cosine-kNN (mean/std, all train):  Val={cosine_val:.4f}, Test={cosine_test:.4f}")