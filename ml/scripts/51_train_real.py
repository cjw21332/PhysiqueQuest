#!/usr/bin/env python3
"""R2: Training loop sanity checks on REAL GIF windows."""
import os
import json
import copy
import time
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from pathlib import Path
from sklearn.metrics import classification_report, confusion_matrix, f1_score
from sklearn.neighbors import KNeighborsClassifier
from sklearn.preprocessing import StandardScaler
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
from collections import Counter

# Local imports
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from src.pq_ml.models import CNN1DClassifier, GRUClassifier, count_parameters
from scripts.build_real_windows import RealGifWindowDataset

# ── Paths ──────────────────────────────────────────────────────────────────
MODELS_DIR = Path("ml/models")
REPORTS_DIR = Path("ml/reports/train_real")
MODELS_DIR.mkdir(parents=True, exist_ok=True)
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Device: {device}")


def train_epoch(model, loader, criterion, optimizer, device):
    model.train()
    total_loss = 0
    correct = 0
    total = 0
    
    for data, target in loader:
        data, target = data.to(device), target.to(device)
        optimizer.zero_grad()
        output = model(data)
        loss = criterion(output, target)
        loss.backward()
        optimizer.step()
        total_loss += loss.item()
        pred = output.argmax(dim=1)
        correct += pred.eq(target).sum().item()
        total += target.size(0)
    
    return total_loss / len(loader), correct / total


def evaluate(model, loader, criterion, device):
    model.eval()
    total_loss = 0
    correct = 0
    total = 0
    all_preds = []
    all_targets = []
    
    with torch.no_grad():
        for data, target in loader:
            data, target = data.to(device), target.to(device)
            output = model(data)
            loss = criterion(output, target)
            total_loss += loss.item()
            pred = output.argmax(dim=1)
            correct += pred.eq(target).sum().item()
            total += target.size(0)
            all_preds.extend(pred.cpu().numpy())
            all_targets.extend(target.cpu().numpy())
    
    return total_loss / len(loader), correct / total, all_preds, all_targets


def train_model(model, train_loader, val_loader, class_to_idx, device, epochs=50, lr=1e-3, weight_decay=1e-4, patience=10, model_name="model"):
    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
    optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=weight_decay)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)
    
    best_val_f1 = 0
    best_state = None
    patience_counter = 0
    history = {"train_loss": [], "train_acc": [], "val_loss": [], "val_acc": [], "val_f1": []}
    
    idx_to_class = {v: k for k, v in class_to_idx.items()}
    class_names = [idx_to_class[i] for i in range(len(class_to_idx))]
    
    print(f"\n=== Training {model_name} ===")
    print(f"Params: {count_parameters(model):,}")
    
    for epoch in range(1, epochs + 1):
        start = time.time()
        train_loss, train_acc = train_epoch(model, train_loader, criterion, optimizer, device)
        val_loss, val_acc, val_preds, val_targets = evaluate(model, val_loader, criterion, device)
        val_f1 = f1_score(val_targets, val_preds, average='macro')
        scheduler.step()
        
        history["train_loss"].append(train_loss)
        history["train_acc"].append(train_acc)
        history["val_loss"].append(val_loss)
        history["val_acc"].append(val_acc)
        history["val_f1"].append(val_f1)
        
        elapsed = time.time() - start
        print(f"Epoch {epoch:3d}/{epochs} | Train: {train_loss:.4f} ({train_acc:.3f}) | Val: {val_loss:.4f} ({val_acc:.3f}) | Val Macro-F1: {val_f1:.4f} | Time: {elapsed:.1f}s")
        
        if val_f1 > best_val_f1:
            best_val_f1 = val_f1
            best_state = copy.deepcopy(model.state_dict())
            patience_counter = 0
            torch.save({
                'epoch': epoch, 'model_state_dict': model.state_dict(),
                'val_f1': val_f1, 'class_to_idx': class_to_idx,
            }, REPORTS_DIR / f"{model_name}_best.pt")
        else:
            patience_counter += 1
            if patience_counter >= patience:
                print(f"Early stopping at epoch {epoch}")
                break
    
    model.load_state_dict(best_state)
    val_loss, val_acc, val_preds, val_targets = evaluate(model, val_loader, criterion, device)
    val_f1 = f1_score(val_targets, val_preds, average='macro')
    
    print(f"\nBest Val Macro-F1: {best_val_f1:.4f}")
    print(f"Final Val: Loss={val_loss:.4f}, Acc={val_acc:.4f}, Macro-F1={val_f1:.4f}")
    
    report = classification_report(val_targets, val_preds, target_names=class_names, output_dict=True, zero_division=0)
    print("\nPer-class:")
    for cls in class_names:
        if cls in report:
            print(f"  {cls:20s} P={report[cls]['precision']:.3f} R={report[cls]['recall']:.3f} F1={report[cls]['f1-score']:.3f} Supp={report[cls]['support']}")
    
    cm = confusion_matrix(val_targets, val_preds)
    plt.figure(figsize=(10, 8))
    sns.heatmap(cm, annot=True, fmt='d', xticklabels=class_names, yticklabels=class_names, cmap='Blues')
    plt.title(f'{model_name} - Val Confusion Matrix')
    plt.xlabel('Predicted'); plt.ylabel('True')
    plt.tight_layout()
    plt.savefig(REPORTS_DIR / f"{model_name}_confusion_val.png", dpi=150)
    plt.close()
    
    with open(REPORTS_DIR / f"{model_name}_history.json", "w") as f:
        json.dump(history, f, indent=2)
    
    metrics = {
        "model": model_name, "best_val_f1": best_val_f1,
        "final_val_loss": val_loss, "final_val_acc": val_acc, "final_val_f1": val_f1,
        "per_class": {cls: report[cls] for cls in class_names if cls in report},
        "confusion_matrix": cm.tolist(),
    }
    with open(REPORTS_DIR / f"{model_name}_metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)
    
    return model, metrics, val_preds, val_targets


# ── DTW Baseline ────────────────────────────────────────────────────────────
def dtw_baseline(train_loader, val_loader, test_loader, class_to_idx, idx_to_class):
    """kNN with cosine distance on keypoint signatures (DTW proxy)."""
    print("\n=== DTW Baseline (kNN + cosine on signatures) ===")
    
    # Simple signature: mean + std per joint per coordinate
    def simple_signature(window):
        # window: (48, 132) -> (48, 33, 4)
        kps = window.reshape(48, 33, 4).numpy() if hasattr(window, 'numpy') else window.reshape(48, 33, 4)
        return np.concatenate([kps.mean(axis=0).flatten(), kps.std(axis=0).flatten()])  # 33*4*2 = 264
    
    # Collect train signatures
    train_sigs, train_labels = [], []
    for data, target in train_loader:
        for i in range(data.shape[0]):
            train_sigs.append(simple_signature(data[i]))
            train_labels.append(target[i].item())
    
    # Collect val signatures
    val_sigs, val_labels = [], []
    for data, target in val_loader:
        for i in range(data.shape[0]):
            val_sigs.append(simple_signature(data[i]))
            val_labels.append(target[i].item())
    
    # Standardize
    scaler = StandardScaler()
    train_sigs = scaler.fit_transform(train_sigs)
    val_sigs = scaler.transform(val_sigs)
    
    # kNN with cosine distance (proxy for DTW)
    knn = KNeighborsClassifier(n_neighbors=3, metric='cosine')
    knn.fit(train_sigs, train_labels)
    
    val_preds = knn.predict(val_sigs)
    val_f1 = f1_score(val_labels, val_preds, average='macro')
    
    class_names = [idx_to_class[i] for i in range(len(class_to_idx))]
    print(f"DTW Baseline (kNN cosine): Macro-F1 = {val_f1:.4f}")
    print(classification_report(val_labels, val_preds, target_names=class_names, zero_division=0))
    
    return val_f1


def main():
    # Load datasets
    train_ds = RealGifWindowDataset("train", augment=True)
    val_ds = RealGifWindowDataset("val", augment=False)
    test_ds = RealGifWindowDataset("test", augment=False)
    
    class_to_idx = train_ds.class_to_idx
    idx_to_class = {v: k for k, v in class_to_idx.items()}
    
    train_loader = DataLoader(train_ds, batch_size=16, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=16, shuffle=False, num_workers=0)
    test_loader = DataLoader(test_ds, batch_size=16, shuffle=False, num_workers=0)
    
    print(f"Train: {len(train_ds)}, Val: {len(val_ds)}, Test: {len(test_ds)}")
    
    # R2a: Overfit 1 batch to ~100% train accuracy
    print("\n=== R2a: Overfit 1 batch ===")
    model = CNN1DClassifier(num_classes=len(class_to_idx)).to(device)
    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
    optimizer = optim.AdamW(model.parameters(), lr=1e-3)
    
    # Get one batch
    data, target = next(iter(train_loader))
    data, target = data.to(device), target.to(device)
    
    model.train()
    for step in range(100):
        optimizer.zero_grad()
        output = model(data)
        loss = criterion(output, target)
        loss.backward()
        optimizer.step()
        if step % 20 == 0:
            acc = output.argmax(dim=1).eq(target).float().mean().item()
            print(f"  Step {step}: loss={loss.item():.4f}, acc={acc:.3f}")
    
    final_acc = model(data).argmax(dim=1).eq(target).float().mean().item()
    print(f"Final overfit acc: {final_acc:.3f} (target ~1.0)")
    
    # R2b: Check batch shapes and normalization
    print("\n=== R2b: Batch inspection ===")
    data, target = next(iter(train_loader))
    print(f"Input shape: {data.shape}")
    print(f"Input range: [{data.min():.3f}, {data.max():.3f}]")
    print(f"Input mean: {data.mean():.3f}, std: {data.std():.3f}")
    print(f"Label range: [{target.min()}, {target.max()}]")
    print(f"Classes: {sorted(target.unique().tolist())}")
    
    # R2c: Train CNN1D
    print("\n=== R2c: Full CNN1D Training ===")
    cnn = CNN1DClassifier(num_classes=len(class_to_idx)).to(device)
    cnn, cnn_metrics, cnn_val_preds, cnn_val_targets = train_model(
        cnn, train_loader, val_loader, class_to_idx, device,
        epochs=60, lr=1e-3, patience=12, model_name="cnn1d_real"
    )
    
    # Train GRU
    print("\n=== R2c: Full GRU Training ===")
    gru = GRUClassifier(num_classes=len(class_to_idx)).to(device)
    gru, gru_metrics, gru_val_preds, gru_val_targets = train_model(
        gru, train_loader, val_loader, class_to_idx, device,
        epochs=60, lr=1e-3, patience=12, model_name="gru_real"
    )
    
    # DTW Baseline
    dtw_f1 = dtw_baseline(train_loader, val_loader, test_loader, class_to_idx, idx_to_class)
    
    # Compare
    print(f"\n=== COMPARISON ===")
    print(f"CNN1D Real: Val Macro-F1 = {cnn_metrics['best_val_f1']:.4f}")
    print(f"GRU Real:   Val Macro-F1 = {gru_metrics['best_val_f1']:.4f}")
    print(f"DTW Baseline: Val Macro-F1 = {dtw_f1:.4f}")
    
    # Test set evaluation
    for name, model in [("CNN1D", cnn), ("GRU", gru)]:
        test_loss, test_acc, test_preds, test_targets = evaluate(model, test_loader, nn.CrossEntropyLoss(), device)
        test_f1 = f1_score(test_targets, test_preds, average='macro')
        print(f"\n{name} TEST: Loss={test_loss:.4f}, Acc={test_acc:.4f}, Macro-F1={test_f1:.4f}")
        print(classification_report(test_targets, test_preds, target_names=[idx_to_class[i] for i in range(len(class_to_idx))], zero_division=0))
    
    print("\n=== SPLIT SIZES PER CLASS ===")
    for split_name, ds in [("Train", train_ds), ("Val", val_ds), ("Test", test_ds)]:
        labels = [ds.idx_to_class[s[2]] for s in ds.samples]
        dist = Counter(labels)
        print(f"{split_name} ({len(ds)}): {dict(dist)}")


if __name__ == "__main__":
    main()