#!/usr/bin/env python3
"""Controlled experiments for the movement-pattern classifier (Phase 5).

Diagnosis (reports/PATTERN_V1_DIAGNOSIS.md) showed the v1 model is a static-pose
classifier: global average pooling discards time order, a single repeated frame
scores 0.4375 vs 0.4688 for the real window. These experiments test the specific
hypotheses that follow from that, one change at a time, with model selection on
subject-grouped CV folds only.

Protocol
  - Test subjects are FROZEN to the five people v1 was evaluated on, so v1 and a
    candidate are compared on identical held-out windows.
  - Everything else is 4-fold subject-grouped CV. No test window is used for
    choosing architecture, loss, features or window length.
  - `--final` trains once on all non-test subjects with the chosen config and
    evaluates the frozen test set a single time.

Usage
  python scripts/76_experiments.py --experiments e1_no_visibility,e2_attention
  python scripts/76_experiments.py --experiments all --folds 4 --epochs 30
  python scripts/76_experiments.py --final --config e2_attention --out models/pattern_v2
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import importlib.util
import json
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from sklearn.metrics import f1_score
from torch.utils.data import DataLoader, Dataset

ML = Path(__file__).resolve().parents[1]
sys_path = ML / "src"
import sys

sys.path.insert(0, str(sys_path))
from pq_ml.models import CNN1DClassifier, GRUClassifier, count_parameters  # noqa: E402

SPEC = importlib.util.spec_from_file_location("train72", ML / "scripts" / "72_train_pattern.py")
train72 = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(train72)

FEATURES = 132
COORDS = 4
TEST_SUBJECTS = ["04996ace", "17e2d98f", "5e3a8d78", "ce0fbe3f", "fcd2886c"]
MIN_SUBJECTS = 4
# Clips whose dataset label is arguably a different pattern (reports/PATTERN_V1_DATA_AUDIT.md).
AMBIGUOUS_EXERCISES = {
    "plank + jumping jack",
    "plank jump + 3 punches",
    "bridge",
    "step jacks",
    "reverse lunges",
    "reverse lunges challenge",
    "wall twist",
    "warrior 2 + up",
}


class WindowDataset(Dataset):
    def __init__(self, x: np.ndarray, y: np.ndarray, augment: bool = False):
        self.x, self.y, self.augment = x, y, augment

    def __len__(self):
        return len(self.x)

    def __getitem__(self, i):
        coords = self.x.shape[2] // 33
        window = self.x[i].reshape(self.x.shape[1], 33, coords).copy()
        if self.augment:
            if np.random.rand() < 0.5:
                window[:, :, 0] *= -1.0
                for a, b in train72.FLIP_PAIRS:
                    window[:, [a, b]] = window[:, [b, a]]
            window += np.random.normal(0.0, 0.01, window.shape).astype(np.float32)
            if np.random.rand() < 0.3:
                drop = np.random.choice(self.x.shape[1], size=4, replace=False)
                window[drop] = 0.0
            shift = int(np.random.randint(-3, 4))
            if shift:
                window = np.roll(window, shift, axis=0)
        return torch.from_numpy(window.reshape(self.x.shape[1], -1)), int(self.y[i])


# ---------------------------------------------------------------- models
class AttentionPool(nn.Module):
    """Learned weighting over time; unlike average pooling it can use order."""

    def __init__(self, channels: int):
        super().__init__()
        self.score = nn.Linear(channels, 1)

    def forward(self, x):  # x: [B, C, T]
        weights = torch.softmax(self.score(x.transpose(1, 2)), dim=1)  # [B, T, 1]
        return (x * weights.transpose(1, 2)).sum(-1)


class TemporalCNN(nn.Module):
    def __init__(self, input_channels=FEATURES, num_classes=7, pool="attention", dropout=0.3):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv1d(input_channels, 128, 5, padding=2), nn.BatchNorm1d(128), nn.ReLU(inplace=True),
            nn.Conv1d(128, 128, 5, padding=2), nn.BatchNorm1d(128), nn.ReLU(inplace=True),
            nn.Dropout(dropout),
        )
        self.pool_kind = pool
        if pool == "attention":
            self.pool = AttentionPool(128)
        elif pool == "maxavg":
            self.pool = None
        self.classifier = nn.Linear(128 * (2 if pool == "maxavg" else 1), num_classes)

    def forward(self, x):
        h = self.conv(x.transpose(1, 2))
        if self.pool_kind == "attention":
            pooled = self.pool(h)
        else:
            pooled = torch.cat([h.mean(-1), h.max(-1).values], dim=1)
        return self.classifier(pooled)


class DilatedTCN(nn.Module):
    def __init__(self, input_channels=FEATURES, num_classes=7, dropout=0.2):
        super().__init__()
        layers, in_ch = [], input_channels
        for dilation in (1, 2, 4):
            layers += [
                nn.Conv1d(in_ch, 96, 3, padding=dilation, dilation=dilation),
                nn.BatchNorm1d(96), nn.ReLU(inplace=True),
            ]
            in_ch = 96
        self.conv = nn.Sequential(*layers, nn.Dropout(dropout))
        self.pool = AttentionPool(96)
        self.classifier = nn.Linear(96, num_classes)

    def forward(self, x):
        return self.classifier(self.pool(self.conv(x.transpose(1, 2))))


def build_model(name: str, features: int, classes: int) -> nn.Module:
    if name == "cnn_avg":  # v1 architecture
        return CNN1DClassifier(input_channels=features, num_classes=classes)
    if name == "cnn_attention":
        return TemporalCNN(features, classes, pool="attention")
    if name == "cnn_maxavg":
        return TemporalCNN(features, classes, pool="maxavg")
    if name == "gru":
        return GRUClassifier(input_size=features, num_classes=classes, hidden_size=96, num_layers=2)
    if name == "tcn":
        return DilatedTCN(features, classes)
    raise SystemExit(f"unknown model {name}")


class FocalLoss(nn.Module):
    def __init__(self, gamma=2.0, weight=None):
        super().__init__()
        self.gamma, self.weight = gamma, weight

    def forward(self, logits, target):
        ce = F.cross_entropy(logits, target, weight=self.weight, reduction="none")
        pt = torch.exp(-ce)
        return ((1 - pt) ** self.gamma * ce).mean()


# ---------------------------------------------------------------- data
def canonical(subject: str) -> str:
    return subject[:8]


def load_dataset(window=48, stride=24, drop_visibility=False, drop_ambiguous=False):
    spec = dict(train72.DATASETS["pushupbench"])
    spec["_mapping"] = {k.lower().strip(): v for k, v in json.loads(spec["mapping"].read_text()).items()}
    directory = spec["keypoints"]

    # Prefer the 8-char subject id when the same footage appears under two ids.
    by_hash: dict[str, Path] = {}
    for path in sorted(directory.glob("*.npz")):
        meta = train72.parse_meta(path, spec)
        if meta is None:
            continue
        digest = hashlib.sha256(np.load(path)["landmarks"].tobytes()).hexdigest()
        current = by_hash.get(digest)
        if current is None or len(meta["subject"]) < len(train72.parse_meta(current, spec)["subject"]):
            by_hash[digest] = path
    kept = set(by_hash.values())

    rows, labels, subjects, stems = [], [], [], []
    skipped_detection = skipped_duplicate = skipped_ambiguous = 0
    for path in sorted(directory.glob("*.npz")):
        if path not in kept:
            skipped_duplicate += 1
            continue
        meta = train72.parse_meta(path, spec)
        if meta is None:
            continue
        if drop_ambiguous and meta["exercise"].lower().strip() in AMBIGUOUS_EXERCISES:
            skipped_ambiguous += 1
            continue
        data = np.load(path)
        landmarks = data["landmarks"].astype(np.float32)
        mask = data["detection_mask"].astype(bool)
        if drop_visibility:
            landmarks = np.delete(landmarks, np.s_[3::4], axis=2)
        if landmarks.shape[0] < window:
            continue
        for start in range(0, landmarks.shape[0] - window + 1, stride):
            stop = start + window
            if mask[start:stop].mean() < train72.MIN_DETECTION_RATE:
                skipped_detection += 1
                continue
            rows.append(landmarks[start:stop].reshape(window, -1))
            labels.append(meta["pattern"])
            subjects.append(canonical(meta["subject"]))
            stems.append(meta["stem"])

    subjects_by_class = collections.defaultdict(set)
    for label, subject in zip(labels, subjects):
        subjects_by_class[label].add(subject)
    classes = sorted(c for c in subjects_by_class if len(subjects_by_class[c]) >= MIN_SUBJECTS)
    index = {c: i for i, c in enumerate(classes)}
    mask = np.isin(labels, classes)
    x = np.stack(rows)[mask]
    y = np.asarray([index[label] for label, keep in zip(labels, mask) if keep])
    subjects = np.asarray(subjects)[mask]
    stems = np.asarray(stems)[mask]
    print(
        f"window={window} features={x.shape[2]} windows={len(x)} subjects={len(set(subjects))} "
        f"classes={len(classes)} (dup {skipped_duplicate}, ambiguous {skipped_ambiguous}, "
        f"low-detection {skipped_detection})"
    )
    return x, y, subjects, stems, classes


def assign_folds(subjects: np.ndarray, y: np.ndarray, n_folds=4, seed=7) -> dict[str, int]:
    """Subject-grouped, class-aware fold assignment (greedy, deterministic)."""
    windows = collections.Counter(subjects)
    classes_of = collections.defaultdict(set)
    per_class_subjects = collections.defaultdict(set)
    for subject, label in zip(subjects, y):
        classes_of[subject].add(int(label))
        per_class_subjects[int(label)].add(subject)

    order = sorted(set(subjects), key=lambda s: (-len(classes_of[s]), -windows[s], s))
    fold: dict[str, int] = {}
    sizes = [0] * n_folds
    for subject in order:
        candidates = sorted(range(n_folds), key=lambda f: (sizes[f], f))
        target = candidates[0]
        fold[subject] = target
        sizes[target] += windows[subject]

    # Repair coverage: every fold must contain every class at least once.
    for label in sorted(per_class_subjects):
        for f in range(n_folds):
            if any(fold[s] == f for s in per_class_subjects[label]):
                continue
            donors = sorted(
                (s for s in per_class_subjects[label] if fold[s] != f),
                key=lambda s: (windows[s], s),
            )
            for donor in donors:
                source = fold[donor]
                others = [s for s in per_class_subjects[label] if s != donor]
                if any(fold[s] == source for s in others):
                    fold[donor] = f
                    break
    return fold


# ---------------------------------------------------------------- training
def run_fold(x, y, train_idx, val_idx, model_name, loss_name, epochs, patience, seed, batch=64, lr=1e-3):
    torch.manual_seed(seed)
    np.random.seed(seed)
    model = build_model(model_name, x.shape[2], int(y.max()) + 1)
    counts = np.bincount(y[train_idx], minlength=int(y.max()) + 1).astype(np.float64)
    weights = torch.tensor(counts.sum() / (len(counts) * np.maximum(counts, 1)), dtype=torch.float32)
    if loss_name == "weighted_ce":
        criterion = nn.CrossEntropyLoss(weight=weights, label_smoothing=0.05)
    elif loss_name == "ce":
        criterion = nn.CrossEntropyLoss(label_smoothing=0.05)
    elif loss_name == "focal":
        criterion = FocalLoss(gamma=2.0, weight=weights)
    else:
        raise SystemExit(f"unknown loss {loss_name}")

    train_loader = DataLoader(WindowDataset(x[train_idx], y[train_idx], True), batch_size=batch, shuffle=True,
                              drop_last=len(train_idx) > batch)
    val_loader = DataLoader(WindowDataset(x[val_idx], y[val_idx]), batch_size=256)
    optimiser = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)

    best_f1, best_state, best_epoch, stale = -1.0, None, 0, 0
    for epoch in range(1, epochs + 1):
        model.train()
        for xb, yb in train_loader:
            optimiser.zero_grad()
            loss = criterion(model(xb), yb)
            loss.backward()
            optimiser.step()
        model.eval()
        preds, targets = [], []
        with torch.no_grad():
            for xb, yb in val_loader:
                preds.append(model(xb).argmax(1).numpy())
                targets.append(yb.numpy())
        pred, target = np.concatenate(preds), np.concatenate(targets)
        val_f1 = float(f1_score(target, pred, average="macro", zero_division=0))
        if val_f1 > best_f1 + 1e-4:
            best_f1, best_epoch, stale = val_f1, epoch, 0
            best_state = {k: v.detach().clone() for k, v in model.state_dict().items()}
        else:
            stale += 1
            if stale >= patience:
                break
    model.load_state_dict(best_state)
    return {
        "best_val_macro_f1": round(best_f1, 4),
        "best_epoch": best_epoch,
        "epochs_run": epoch,
        "model": model,
        "parameters": count_parameters(model),
    }


def evaluate(model, x, y):
    model.eval()
    with torch.no_grad():
        pred = model(torch.from_numpy(x)).argmax(1).numpy()
    return {
        "accuracy": round(float((pred == y).mean()), 4),
        "macro_f1": round(float(f1_score(y, pred, average="macro", zero_division=0)), 4),
        "pred": pred,
    }


def probe_temporal(model, x, y):
    """If a single repeated frame scores ~= the real window, time is ignored."""
    window = x.shape[1]
    single = np.repeat(x[:, window // 2: window // 2 + 1], window, axis=1)
    reversed_x = np.ascontiguousarray(x[:, ::-1])
    return {
        "identity": evaluate(model, x, y)["accuracy"],
        "single_frame": evaluate(model, single, y)["accuracy"],
        "time_reversed": evaluate(model, reversed_x, y)["accuracy"],
    }


EXPERIMENTS = {
    "e0_v1_baseline": dict(model="cnn_avg", loss="weighted_ce", window=48, drop_visibility=False, drop_ambiguous=False),
    "e1_no_visibility": dict(model="cnn_avg", loss="weighted_ce", window=48, drop_visibility=True, drop_ambiguous=False),
    "e2_attention": dict(model="cnn_attention", loss="weighted_ce", window=48, drop_visibility=False, drop_ambiguous=False),
    "e3_gru": dict(model="gru", loss="weighted_ce", window=48, drop_visibility=False, drop_ambiguous=False),
    "e4_tcn": dict(model="tcn", loss="weighted_ce", window=48, drop_visibility=False, drop_ambiguous=False),
    "e5_window64": dict(model="cnn_attention", loss="weighted_ce", window=64, drop_visibility=False, drop_ambiguous=False),
    "e6_window32": dict(model="cnn_attention", loss="weighted_ce", window=32, drop_visibility=False, drop_ambiguous=False),
    "e7_no_class_weights": dict(model="cnn_attention", loss="ce", window=48, drop_visibility=False, drop_ambiguous=False),
    "e8_focal": dict(model="cnn_attention", loss="focal", window=48, drop_visibility=False, drop_ambiguous=False),
    "e9_clean_labels": dict(model="cnn_attention", loss="weighted_ce", window=48, drop_visibility=False, drop_ambiguous=True),
    "e10_maxavg": dict(model="cnn_maxavg", loss="weighted_ce", window=48, drop_visibility=False, drop_ambiguous=False),
}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--experiments", default="e0_v1_baseline,e2_attention")
    ap.add_argument("--folds", type=int, default=4)
    ap.add_argument("--epochs", type=int, default=30)
    ap.add_argument("--patience", type=int, default=6)
    ap.add_argument("--seeds", default="7")
    ap.add_argument("--final", action="store_true", help="train on all non-test subjects and evaluate test once")
    ap.add_argument("--config", default="e2_attention")
    ap.add_argument("--out", type=Path, default=ML / "models" / "pattern_v2")
    ap.add_argument("--report", type=Path, default=ML / "reports" / "experiments")
    args = ap.parse_args()

    names = list(EXPERIMENTS) if args.experiments == "all" else [n.strip() for n in args.experiments.split(",") if n.strip()]
    for name in names:
        if name not in EXPERIMENTS:
            raise SystemExit(f"unknown experiment {name}")

    # Cache the loaded dataset per (window, features, ambiguous) combination.
    cache: dict[tuple, tuple] = {}

    def data_for(cfg):
        key = (cfg["window"], cfg["drop_visibility"], cfg["drop_ambiguous"])
        if key not in cache:
            cache[key] = load_dataset(cfg["window"], 24, cfg["drop_visibility"], cfg["drop_ambiguous"])
        return cache[key]

    args.report.mkdir(parents=True, exist_ok=True)
    if args.final:
        return run_final(args, data_for)

    summary = []
    for name in names:
        cfg = EXPERIMENTS[name]
        x, y, subjects, _stems, classes = data_for(cfg)
        # Model selection never touches the frozen test people.
        pool = np.flatnonzero(~np.isin(subjects, TEST_SUBJECTS))
        fold_of = assign_folds(subjects[pool], y[pool], args.folds)
        pool_folds = np.asarray([fold_of[s] for s in subjects[pool]])
        folds = sorted(set(fold_of.values()))
        runs = []
        for seed in [int(s) for s in args.seeds.split(",") if s.strip()]:
            for fold in folds:
                val_idx = pool[pool_folds == fold]
                train_idx = pool[pool_folds != fold]
                started = time.time()
                result = run_fold(x, y, train_idx, val_idx, cfg["model"], cfg["loss"], args.epochs, args.patience, seed)
                runs.append({
                    "seed": seed,
                    "fold": int(fold),
                    "val_accuracy": None,
                    "val_macro_f1": result["best_val_macro_f1"],
                    "best_epoch": result["best_epoch"],
                    "epochs_run": result["epochs_run"],
                    "parameters": result["parameters"],
                    "seconds": round(time.time() - started, 1),
                })
                print(f"  {name} seed={seed} fold={fold} val_f1={result['best_val_macro_f1']:.4f} "
                      f"epoch={result['best_epoch']} ({runs[-1]['seconds']}s)", flush=True)
        f1s = [r["val_macro_f1"] for r in runs]
        record = {
            "experiment": name,
            "config": cfg,
            "classes": classes,
            "windows": int(len(x)),
            "cv_folds": folds,
            "seeds": [int(s) for s in args.seeds.split(",") if s.strip()],
            "folds": runs,
            "mean_val_macro_f1": round(float(np.mean(f1s)), 4),
            "sd_val_macro_f1": round(float(np.std(f1s)), 4),
            "min_val_macro_f1": round(float(np.min(f1s)), 4),
            "max_val_macro_f1": round(float(np.max(f1s)), 4),
            "median_best_epoch": int(np.median([r["best_epoch"] for r in runs])),
        }
        (args.report / f"{name}.json").write_text(json.dumps(record, indent=2))
        summary.append(record)
        print(f"{name}: mean val macro-F1 {record['mean_val_macro_f1']:.4f} ± {record['sd_val_macro_f1']:.4f}")

    summary.sort(key=lambda r: -r["mean_val_macro_f1"])
    (args.report / "summary.json").write_text(json.dumps(summary, indent=2))
    print("\nranked (val only, test untouched):")
    for record in summary:
        print(f"  {record['mean_val_macro_f1']:.4f} ± {record['sd_val_macro_f1']:.4f}  {record['experiment']}")
    return 0


def run_final(args, data_for) -> int:
    cfg = EXPERIMENTS[args.config]
    x, y, subjects, stems, classes = data_for(cfg)
    test_mask = np.isin(subjects, TEST_SUBJECTS)
    if not test_mask.any():
        raise SystemExit("no frozen test subjects present")
    train_idx = np.flatnonzero(~test_mask)
    test_idx = np.flatnonzero(test_mask)

    torch.manual_seed(7)
    np.random.seed(7)
    model = build_model(cfg["model"], x.shape[2], len(classes))
    counts = np.bincount(y[train_idx], minlength=len(classes)).astype(np.float64)
    weights = torch.tensor(counts.sum() / (len(counts) * np.maximum(counts, 1)), dtype=torch.float32)
    criterion = nn.CrossEntropyLoss(weight=weights, label_smoothing=0.05)
    loader = DataLoader(WindowDataset(x[train_idx], y[train_idx], True), batch_size=64, shuffle=True, drop_last=True)
    optimiser = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)

    epochs = 30
    history = []
    for epoch in range(1, epochs + 1):
        model.train()
        total = 0.0
        for xb, yb in loader:
            optimiser.zero_grad()
            loss = criterion(model(xb), yb)
            loss.backward()
            optimiser.step()
            total += float(loss) * len(xb)
        history.append(round(total / len(train_idx), 4))
    model.eval()
    with torch.no_grad():
        logits = model(torch.from_numpy(x))
    pred = logits.argmax(1).numpy()
    probe = probe_temporal(model, x[test_idx], y[test_idx])
    args.out.mkdir(parents=True, exist_ok=True)
    torch.save({"state_dict": model.state_dict(), "config": cfg, "classes": classes}, args.out / "model.pt")

    from sklearn.metrics import confusion_matrix, precision_recall_fscore_support

    precision, recall, f1, support = precision_recall_fscore_support(
        y[test_idx], pred[test_idx], labels=list(range(len(classes))), zero_division=0
    )
    per_class = {
        cls: {"precision": round(float(precision[i]), 4), "recall": round(float(recall[i]), 4),
              "f1": round(float(f1[i]), 4), "support": int(support[i])}
        for i, cls in enumerate(classes)
    }
    from pq_ml.models import export_to_onnx

    onnx_path = args.out / "cnn1d.onnx"
    export_to_onnx(model, (1, cfg["window"], x.shape[2]), str(onnx_path), opset_version=17)
    accuracy = float((pred[test_idx] == y[test_idx]).mean())
    macro_f1 = float(f1_score(y[test_idx], pred[test_idx], average="macro", zero_division=0))
    result = {
        "experiment": args.config,
        "config": cfg,
        "classes": classes,
        "train_windows": int(len(train_idx)),
        "test_windows": int(len(test_idx)),
        "test_subjects": sorted(set(subjects[test_idx])),
        "epochs": epochs,
        "final_train_loss": history[-1],
        "test": {
            "accuracy": round(accuracy, 4),
            "macro_f1": round(macro_f1, 4),
            "per_class": per_class,
            "confusion_matrix": confusion_matrix(y[test_idx], pred[test_idx], labels=list(range(len(classes)))).tolist(),
        },
        "temporal_probe": probe,
        "parameters": count_parameters(model),
    }
    (args.out / "metrics.json").write_text(json.dumps(result, indent=2))
    print(json.dumps(result["test"], indent=2))
    print("temporal probe:", probe)
    print(f"wrote {args.out / 'metrics.json'} and {onnx_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
