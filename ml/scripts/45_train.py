#!/usr/bin/env python3
"""Train movement pattern classifier (1D-CNN and GRU)."""
import os
import json
import yaml
import time
import copy
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from sklearn.metrics import classification_report, confusion_matrix
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns

# Local imports
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from src.pq_ml.dataset import get_dataloaders, KeypointSequenceDataset
from src.pq_ml.models import CNN1DClassifier, GRUClassifier, count_parameters, export_to_onnx


def train_epoch(model, loader, criterion, optimizer, device, scheduler=None):
    model.train()
    total_loss = 0
    correct = 0
    total = 0
    
    for batch_idx, (data, target) in enumerate(loader):
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
    
    if scheduler:
        scheduler.step()
    
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


def train_model(
    model,
    train_loader,
    val_loader,
    class_to_idx,
    device,
    epochs=50,
    lr=1e-3,
    weight_decay=1e-4,
    patience=10,
    model_name="model",
    output_dir="ml/reports/train",
):
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
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
    print(f"Device: {device}")
    print(f"Params: {count_parameters(model):,}")
    print(f"Classes: {class_names}")
    
    for epoch in range(1, epochs + 1):
        start = time.time()
        
        train_loss, train_acc = train_epoch(model, train_loader, criterion, optimizer, device, scheduler)
        val_loss, val_acc, val_preds, val_targets = evaluate(model, val_loader, criterion, device)
        
        # Macro F1
        from sklearn.metrics import f1_score
        val_f1 = f1_score(val_targets, val_preds, average='macro')
        
        history["train_loss"].append(train_loss)
        history["train_acc"].append(train_acc)
        history["val_loss"].append(val_loss)
        history["val_acc"].append(val_acc)
        history["val_f1"].append(val_f1)
        
        elapsed = time.time() - start
        print(f"Epoch {epoch:3d}/{epochs} | "
              f"Train: {train_loss:.4f} ({train_acc:.3f}) | "
              f"Val: {val_loss:.4f} ({val_acc:.3f}) | "
              f"Val Macro-F1: {val_f1:.4f} | "
              f"Time: {elapsed:.1f}s")
        
        # Save best
        if val_f1 > best_val_f1:
            best_val_f1 = val_f1
            best_state = copy.deepcopy(model.state_dict())
            patience_counter = 0
            # Save checkpoint
            torch.save({
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'val_f1': val_f1,
                'class_to_idx': class_to_idx,
            }, output_dir / f"{model_name}_best.pt")
        else:
            patience_counter += 1
            if patience_counter >= patience:
                print(f"Early stopping at epoch {epoch}")
                break
    
    # Load best model
    model.load_state_dict(best_state)
    
    # Final evaluation
    val_loss, val_acc, val_preds, val_targets = evaluate(model, val_loader, criterion, device)
    val_f1 = f1_score(val_targets, val_preds, average='macro')
    
    print(f"\nBest Val Macro-F1: {best_val_f1:.4f}")
    print(f"Final Val Loss: {val_loss:.4f}, Acc: {val_acc:.4f}, Macro-F1: {val_f1:.4f}")
    
    # Classification report
    report = classification_report(val_targets, val_preds, target_names=class_names, output_dict=True)
    print("\nPer-class metrics:")
    for cls in class_names:
        if cls in report:
            print(f"  {cls:20s} P={report[cls]['precision']:.3f} R={report[cls]['recall']:.3f} F1={report[cls]['f1-score']:.3f} Support={report[cls]['support']}")
    
    # Confusion matrix
    cm = confusion_matrix(val_targets, val_preds)
    plt.figure(figsize=(10, 8))
    sns.heatmap(cm, annot=True, fmt='d', xticklabels=class_names, yticklabels=class_names, cmap='Blues')
    plt.title(f'{model_name} - Confusion Matrix (Val)')
    plt.xlabel('Predicted')
    plt.ylabel('True')
    plt.tight_layout()
    plt.savefig(output_dir / f"{model_name}_confusion.png", dpi=150)
    plt.close()
    
    # Save history
    with open(output_dir / f"{model_name}_history.json", "w") as f:
        json.dump(history, f, indent=2)
    
    # Save metrics
    metrics = {
        "model": model_name,
        "best_val_f1": best_val_f1,
        "final_val_loss": val_loss,
        "final_val_acc": val_acc,
        "final_val_f1": val_f1,
        "per_class": {cls: report[cls] for cls in class_names if cls in report},
        "confusion_matrix": cm.tolist(),
        "epochs_trained": len(history["train_loss"]),
    }
    with open(output_dir / f"{model_name}_metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)
    
    return model, metrics


def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")
    if device.type == "cuda":
        print(f"GPU: {torch.cuda.get_device_name(0)}")
        torch.backends.cudnn.benchmark = True
    
    # Data
    train_loader, val_loader, test_loader, class_to_idx = get_dataloaders(
        splits_csv="data/manifests/splits_v1.csv",
        batch_size=32,
        num_workers=0,
    )
    
    num_classes = len(class_to_idx)
    
    # Train CNN1D
    cnn = CNN1DClassifier(num_classes=num_classes).to(device)
    cnn, cnn_metrics = train_model(
        cnn, train_loader, val_loader, class_to_idx, device,
        epochs=60, lr=1e-3, patience=12,
        model_name="cnn1d", output_dir="ml/reports/train"
    )
    
    # Train GRU
    gru = GRUClassifier(num_classes=num_classes).to(device)
    gru, gru_metrics = train_model(
        gru, train_loader, val_loader, class_to_idx, device,
        epochs=60, lr=1e-3, patience=12,
        model_name="gru", output_dir="ml/reports/train"
    )
    
    # Export to ONNX
    models_dir = Path("ml/models")
    models_dir.mkdir(parents=True, exist_ok=True)
    
    input_shape = (1, 48, 132)  # batch, seq, features
    
    export_to_onnx(cnn.cpu(), input_shape, models_dir / "cnn1d.onnx")
    export_to_onnx(gru.cpu(), input_shape, models_dir / "gru.onnx")
    
    print("\n=== TRAINING COMPLETE ===")
    print(f"CNN1D best val F1: {cnn_metrics['best_val_f1']:.4f}")
    print(f"GRU best val F1: {gru_metrics['best_val_f1']:.4f}")


if __name__ == "__main__":
    main()