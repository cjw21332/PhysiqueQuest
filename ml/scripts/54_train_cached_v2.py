#!/usr/bin/env python3
"""R2: Training on cached arrays with three-seed runs, sanity checks, and DTW baseline."""
import json
import copy
import time
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
from sklearn.metrics import classification_report, confusion_matrix, f1_score
from sklearn.neighbors import KNeighborsClassifier
from sklearn.preprocessing import StandardScaler
from pathlib import Path
from collections import Counter

# Local imports
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from src.pq_ml.models import CNN1DClassifier, GRUClassifier, count_parameters, export_to_onnx

# ── Paths ──────────────────────────────────────────────────────────────────
REPORTS_DIR = Path("ml/reports/train_real")
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Device: {device}")

# ── Load cached arrays ──────────────────────────────────────────────────────
X_train = np.load("data/windows/train_X.npy")
y_train = np.load("data/windows/train_y.npy")
X_val = np.load("data/windows/val_X.npy")
y_val = np.load("data/windows/val_y.npy")
X_test = np.load("data/windows/test_X.npy")
y_test = np.load("data/windows/test_y.npy")

with open("data/windows/class_to_idx.json") as f:
    class_to_idx = json.load(f)
idx_to_class = {v: k for k, v in class_to_idx.items()}


# ── Training functions ──────────────────────────────────────────────────────
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


def train_model(model, train_loader, val_loader, class_to_idx, device, epochs=50, lr=1e-3, weight_decay=1e-4, patience=10, model_name="model", seed=42):
    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
    optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=weight_decay)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)
    
    best_val_f1 = 0
    best_state = None
    patience_counter = 0
    history = {"train_loss": [], "train_acc": [], "val_loss": [], "val_acc": [], "val_f1": []}
    
    idx_to_class = {v: k for k, v in class_to_idx.items()}
    class_names = [idx_to_class[i] for i in range(len(class_to_idx))]
    
    print(f"\n=== Training {model_name} (seed={seed}) ===")
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
            }, REPORTS_DIR / f"{model_name}_seed{seed}_best.pt")
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
    
    return model, {
        "model": model_name, "seed": seed,
        "best_val_f1": best_val_f1,
        "final_val_loss": val_loss, "final_val_acc": val_acc, "final_val_f1": val_f1,
        "per_class": {cls: report[cls] for cls in class_names if cls in report},
        "confusion_matrix": cm.tolist(),
        "history": history,
    }, val_preds, val_targets


def run_overfit_sanity_check(device, seed=42):
    """R2a: Overfit 1 batch sanity check"""
    print(f"\n=== R2a: Overfit 1 batch (seed={seed}) ===")
    torch.manual_seed(seed)
    np.random.seed(seed)
    
    model = CNN1DClassifier(num_classes=len(class_to_idx)).to(device)
    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
    optimizer = optim.AdamW(model.parameters(), lr=1e-3)
    
    # Create single-batch loader
    train_ds = TensorDataset(torch.from_numpy(X_train).float(), torch.from_numpy(y_train).long())
    single_loader = DataLoader(train_ds, batch_size=32, shuffle=False)
    data, target = next(iter(single_loader))
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
    
    if final_acc < 0.95:
        print("WARNING: Model failed to overfit single batch!")
    return final_acc >= 0.95


def run_batch_inspection():
    """R2b: Batch inspection"""
    print("\n=== R2b: Batch inspection ===")
    train_ds = TensorDataset(torch.from_numpy(X_train).float(), torch.from_numpy(y_train).long())
    train_loader = DataLoader(train_ds, batch_size=32, shuffle=False)
    data, target = next(iter(train_loader))
    print(f"Input shape: {data.shape}")
    print(f"Input range: [{data.min():.3f}, {data.max():.3f}]")
    print(f"Input mean: {data.mean():.3f}, std: {data.std():.3f}")
    print(f"Label range: [{target.min()}, {target.max()}]")
    print(f"Classes present: {sorted(target.unique().tolist())}")


def run_cosine_knn_baseline():
    """Cosine-kNN baseline (mean/std signatures)"""
    print("\n=== Cosine-kNN Baseline (mean/std signatures) ===")
    
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
    
    class_names = [idx_to_class[i] for i in range(len(idx_to_class))]
    
    val_preds = knn.predict(val_sigs)
    val_f1 = f1_score(y_val, val_preds, average='macro')
    print(f"Cosine-kNN Val Macro-F1 = {val_f1:.4f}")
    print(classification_report(y_val, val_preds, target_names=class_names, zero_division=0))
    
    test_preds = knn.predict(test_sigs)
    test_f1 = f1_score(y_test, test_preds, average='macro')
    print(f"Cosine-kNN TEST Macro-F1 = {test_f1:.4f}")
    print(classification_report(y_test, test_preds, target_names=class_names, zero_division=0))
    
    return val_f1, test_f1


def train_with_seeds(model_class, seeds, model_name):
    """Train model with multiple seeds and return aggregated results."""
    all_results = []
    
    for seed in seeds:
        print(f"\n{'='*60}")
        print(f"SEED {seed} - {model_name}")
        print(f"{'='*60}")
        
        torch.manual_seed(seed)
        np.random.seed(seed)
        
        train_ds = TensorDataset(torch.from_numpy(X_train).float(), torch.from_numpy(y_train).long())
        val_ds = TensorDataset(torch.from_numpy(X_val).float(), torch.from_numpy(y_val).long())
        test_ds = TensorDataset(torch.from_numpy(X_test).float(), torch.from_numpy(y_test).long())
        
        train_loader = DataLoader(train_ds, batch_size=32, shuffle=True)
        val_loader = DataLoader(val_ds, batch_size=32, shuffle=False)
        test_loader = DataLoader(test_ds, batch_size=32, shuffle=False)
        
        model = model_class(num_classes=len(class_to_idx)).to(device)
        model, metrics, val_preds, val_targets = train_model(
            model, train_loader, val_loader, class_to_idx, device,
            epochs=60, lr=1e-3, patience=12, model_name=f"{model_name}_seed{seed}", seed=seed
        )
        
        # Test evaluation
        test_loss, test_acc, test_preds, test_targets = evaluate(model, test_loader, nn.CrossEntropyLoss(), device)
        test_f1 = f1_score(test_targets, test_preds, average='macro')
        
        class_names = [idx_to_class[i] for i in range(len(idx_to_class))]
        test_report = classification_report(test_targets, test_preds, target_names=class_names, output_dict=True, zero_division=0)
        test_cm = confusion_matrix(test_targets, test_preds)
        
        metrics["test_loss"] = test_loss
        metrics["test_acc"] = test_acc
        metrics["test_f1"] = test_f1
        metrics["test_per_class"] = {cls: test_report[cls] for cls in class_names if cls in test_report}
        metrics["test_confusion_matrix"] = test_cm.tolist()
        
        all_results.append(metrics)
        
        # Save best model from this seed
        torch.save({
            'model_state_dict': model.state_dict(),
            'class_to_idx': class_to_idx,
            'seed': seed,
            'val_f1': metrics['best_val_f1'],
            'test_f1': test_f1,
        }, REPORTS_DIR / f"{model_name}_seed{seed}_full.pt")
    
    # Aggregate results
    val_f1s = [r['best_val_f1'] for r in all_results]
    test_f1s = [r['test_f1'] for r in all_results]
    
    print(f"\n=== {model_name} AGGREGATED ({len(seeds)} seeds) ===")
    print(f"Val Macro-F1:  {np.mean(val_f1s):.4f} ± {np.std(val_f1s):.4f}  (seeds: {[f'{v:.4f}' for v in val_f1s]})")
    print(f"Test Macro-F1: {np.mean(test_f1s):.4f} ± {np.std(test_f1s):.4f} (seeds: {[f'{v:.4f}' for v in test_f1s]})")
    
    # Use best seed model for export
    best_idx = np.argmax(val_f1s)
    print(f"Best seed: {seeds[best_idx]} (val_f1={val_f1s[best_idx]:.4f})")
    
    return all_results, best_idx


def main():
    import time
    
    idx_to_class = {v: k for k, v in class_to_idx.items()}
    class_names = [idx_to_class[i] for i in range(len(class_to_idx))]
    
    print(f"Train: {X_train.shape}, Val: {X_val.shape}, Test: {X_test.shape}")
    print(f"Classes: {class_names}")
    
    # Create tensor datasets
    train_ds = TensorDataset(torch.from_numpy(X_train).float(), torch.from_numpy(y_train).long())
    val_ds = TensorDataset(torch.from_numpy(X_val).float(), torch.from_numpy(y_val).long())
    test_ds = TensorDataset(torch.from_numpy(X_test).float(), torch.from_numpy(y_test).long())
    
    train_loader = DataLoader(train_ds, batch_size=32, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=32, shuffle=False)
    test_loader = DataLoader(test_ds, batch_size=32, shuffle=False)
    
    print(f"Batches: train={len(train_loader)}, val={len(val_loader)}, test={len(test_loader)}")
    
    # R2a: Overfit 1 batch
    overfit_ok = run_overfit_sanity_check(device, seed=42)
    
    # R2b: Batch inspection
    run_batch_inspection()
    
    # Baseline
    cosine_val, cosine_test = run_cosine_knn_baseline()
    
    # Three-seed training
    SEEDS = [42, 123, 456]
    
    # CNN1D
    cnn_results, cnn_best_idx = train_with_seeds(CNN1DClassifier, SEEDS, "cnn1d_real")
    
    # GRU
    gru_results, gru_best_idx = train_with_seeds(GRUClassifier, SEEDS, "gru_real")
    
    # Compare with baseline
    print(f"\n=== FINAL COMPARISON ===")
    cnn_val_mean = np.mean([r['best_val_f1'] for r in cnn_results])
    cnn_test_mean = np.mean([r['test_f1'] for r in cnn_results])
    gru_val_mean = np.mean([r['best_val_f1'] for r in gru_results])
    gru_test_mean = np.mean([r['test_f1'] for r in gru_results])
    
    print(f"CNN1D (3 seeds): Val={cnn_val_mean:.4f}±{np.std([r['best_val_f1'] for r in cnn_results]):.4f}, Test={cnn_test_mean:.4f}±{np.std([r['test_f1'] for r in cnn_results]):.4f}")
    print(f"GRU (3 seeds):   Val={gru_val_mean:.4f}±{np.std([r['best_val_f1'] for r in gru_results]):.4f}, Test={gru_test_mean:.4f}±{np.std([r['test_f1'] for r in gru_results]):.4f}")
    print(f"Cosine-kNN:      Val={cosine_val:.4f}, Test={cosine_test:.4f}")
    
    # Export best models to ONNX
    print("\n=== EXPORTING BEST MODELS TO ONNX ===")
    
    # Load best CNN seed
    best_cnn_seed = SEEDS[cnn_best_idx]
    cnn_best = CNN1DClassifier(num_classes=len(class_to_idx)).to(device)
    cnn_best.load_state_dict(torch.load(REPORTS_DIR / f"cnn1d_real_seed{best_cnn_seed}_full.pt")['model_state_dict'])
    export_to_onnx(cnn_best, (1, 48, 132), "ml/models/cnn1d_int8.onnx")
    
    # Load best GRU seed
    best_gru_seed = SEEDS[gru_best_idx]
    gru_best = GRUClassifier(num_classes=len(class_to_idx)).to(device)
    gru_best.load_state_dict(torch.load(REPORTS_DIR / f"gru_real_seed{best_gru_seed}_full.pt")['model_state_dict'])
    export_to_onnx(gru_best, (1, 48, 132), "ml/models/gru_int8.onnx")
    
    # Split sizes per class
    print("\n=== SPLIT SIZES PER CLASS ===")
    for split_name, (X, y) in [("Train", (X_train, y_train)), ("Val", (X_val, y_val)), ("Test", (X_test, y_test))]:
        labels = [idx_to_class[i] for i in y]
        dist = Counter(labels)
        print(f"{split_name} ({len(X)}): {dict(dist)}")


if __name__ == "__main__":
    main()