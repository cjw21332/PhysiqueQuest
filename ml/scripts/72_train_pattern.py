#!/usr/bin/env python3
"""Real-data training pipeline for the movement-pattern classifier.

Trains only on licence-cleared local recordings (see reports/DATASET_DISCOVERY.md),
because the previous cnn1d/gru artifacts were fitted to synthetic sine waves and
are marked INVALID in models/manifest.json.

Pipeline
  npz keypoint sequences (FEATURE_SPEC preprocessing)
    -> 48-frame windows, stride 24, drop windows with <50% detections
    -> subject-disjoint train/val/test (no subject spans two splits)
    -> CNN1D with class-weighted loss, early stop on val macro-F1
    -> one-shot test evaluation (test is never used for model selection)
    -> ONNX export, dynamic int8 quantisation, torch/ORT parity check
    -> manifest with full provenance, licence and metrics

Usage
  python scripts/72_train_pattern.py --dataset pushupbench
  python scripts/72_train_pattern.py --dataset pushupbench --epochs 40 --seed 7
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import re
import sys
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from sklearn.metrics import confusion_matrix, f1_score, precision_recall_fscore_support
from torch.utils.data import DataLoader, Dataset

ML = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ML / "src"))
from pq_ml.models import CNN1DClassifier, count_parameters  # noqa: E402

WINDOW = 48
STRIDE = 24
FEATURES = 33 * 4
MIN_DETECTION_RATE = 0.5
MIN_SUBJECTS_PER_CLASS = 4
SPLITS = ("train", "val", "test")

DATASETS = {
    "pushupbench": {
        "keypoints": ML / "data" / "keypoints_pushupbench",
        "raw": ML / "data" / "raw" / "real_video" / "pushupbench",
        "mapping": ML / "configs" / "pushupbench_taxonomy_mapping.json",
        "pattern": re.compile(r"^([0-9a-f]{8,})_\d+_(.+?)_\[([0-9\-]+)\]$"),
        "license": "CC-BY-4.0",
        "source": "https://huggingface.co/datasets/anonymousatom/pushupbench",
        "out": ML / "models" / "pattern_v1",
        "report": ML / "reports" / "pattern_training.json",
    }
}

# Mirror partner indices for left/right flip augmentation (x negation + swap).
FLIP_PAIRS = [(1, 4), (2, 5), (3, 6), (7, 8), (9, 10), (11, 12), (13, 14),
              (15, 16), (17, 18), (19, 20), (21, 22), (23, 24), (25, 26),
              (27, 28), (29, 30), (31, 32)]


def parse_meta(path: Path, spec: dict) -> dict | None:
    match = spec["pattern"].match(path.stem)
    if not match:
        return None
    group, name, reps = match.groups()
    mapping = spec["_mapping"]
    pattern = mapping.get(name.lower().strip())
    if pattern is None:
        return None
    return {
        "stem": path.stem,
        "subject": group,
        "exercise": name,
        "pattern": pattern,
        "gt_reps": [int(x) for x in reps.split("-")],
    }


def load_windows(directory: Path, spec: dict) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Return (X, pattern, subject, video_stem) for every kept window."""
    npzs = sorted(directory.glob("*.npz"))
    raw_by_stem = {p.stem: p for p in spec["raw"].glob("*.mp4")}
    rows, labels, subjects, stems = [], [], [], []
    skipped_detection = skipped_meta = 0
    for npz_path in npzs:
        meta = parse_meta(npz_path, spec)
        raw = raw_by_stem.get(npz_path.stem)
        if meta is None or raw is None:
            skipped_meta += 1
            continue
        data = np.load(npz_path)
        landmarks = data["landmarks"].astype(np.float32)
        mask = data["detection_mask"].astype(bool)
        if landmarks.shape[0] < WINDOW:
            skipped_meta += 1
            continue
        for start in range(0, landmarks.shape[0] - WINDOW + 1, STRIDE):
            stop = start + WINDOW
            if mask[start:stop].mean() < MIN_DETECTION_RATE:
                skipped_detection += 1
                continue
            rows.append(landmarks[start:stop].reshape(WINDOW, FEATURES))
            labels.append(meta["pattern"])
            subjects.append(meta["subject"])
            stems.append(meta["stem"])
    if not rows:
        raise SystemExit(
            f"no usable windows in {directory}. Run scripts/71_extract_videos.py first."
        )
    print(
        f"loaded {len(rows)} windows from {len(npzs)} sequences "
        f"(skipped {skipped_detection} low-detection, {skipped_meta} unusable)"
    )
    return np.stack(rows), np.asarray(labels), np.asarray(subjects), np.asarray(stems)


def assign_splits(labels: np.ndarray, subjects: np.ndarray, seed: int) -> tuple[dict[str, str], list[str]]:
    """Deterministic subject-disjoint split with per-class coverage repair."""
    subjects_by_class: dict[str, set[str]] = collections.defaultdict(set)
    videos_by_class_subject: collections.Counter = collections.Counter()
    for label, subject in zip(labels, subjects):
        subjects_by_class[label].add(subject)
        videos_by_class_subject[(label, subject)] += 1

    assignment: dict[str, str] = {}
    for subject in sorted(set(subjects)):
        bucket = int(hashlib.md5(f"{seed}:{subject}".encode()).hexdigest()[:8], 16) % 100
        assignment[subject] = "train" if bucket < 70 else "val" if bucket < 85 else "test"

    dropped: list[str] = []
    for cls in sorted(subjects_by_class, key=lambda c: len(subjects_by_class[c])):
        for split in ("train", "val", "test"):
            if any(assignment[s] == split for s in subjects_by_class[cls]):
                continue
            # Move the class's smallest donor subject out of a split that keeps coverage.
            donors = sorted(
                (s for s in subjects_by_class[cls] if assignment[s] != split),
                key=lambda s: (videos_by_class_subject[(cls, s)], s),
            )
            moved = False
            for donor in donors:
                current = assignment[donor]
                others = [s for s in subjects_by_class[cls] if s != donor]
                if not any(assignment[s] == current for s in others):
                    continue  # would strip the class from its current split
                assignment[donor] = split
                moved = True
                break
            if not moved:
                dropped.append(cls)
                break
    return assignment, sorted(set(dropped))


class WindowDataset(Dataset):
    def __init__(self, x: np.ndarray, y: np.ndarray, augment: bool = False):
        self.x = x
        self.y = y
        self.augment = augment

    def __len__(self) -> int:
        return len(self.x)

    def __getitem__(self, i: int):
        window = self.x[i].reshape(WINDOW, 33, 4).copy()
        if self.augment:
            if np.random.rand() < 0.5:
                window[:, :, 0] *= -1.0
                for a, b in FLIP_PAIRS:
                    window[:, [a, b]] = window[:, [b, a]]
            window += np.random.normal(0.0, 0.01, window.shape).astype(np.float32)
            if np.random.rand() < 0.3:
                drop = np.random.choice(WINDOW, size=4, replace=False)
                window[drop] = 0.0
            shift = int(np.random.randint(-3, 4))
            if shift:
                window = np.roll(window, shift, axis=0)
        return torch.from_numpy(window.reshape(WINDOW, FEATURES)), int(self.y[i])


def evaluate(model: nn.Module, loader: DataLoader) -> tuple[float, float, np.ndarray, np.ndarray]:
    model.eval()
    preds, targets = [], []
    with torch.no_grad():
        for xb, yb in loader:
            preds.append(model(xb).argmax(1).numpy())
            targets.append(yb.numpy())
    pred = np.concatenate(preds)
    target = np.concatenate(targets)
    return (
        float((pred == target).mean()),
        float(f1_score(target, pred, average="macro", zero_division=0)),
        pred,
        target,
    )


def export_onnx(model: nn.Module, path: Path) -> None:
    model.eval()
    dummy = torch.randn(1, WINDOW, FEATURES)
    torch.onnx.export(
        model,
        dummy,
        str(path),
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={"input": {0: "batch"}, "output": {0: "batch"}},
        opset_version=17,
        do_constant_folding=True,
    )


def ort_logits(path: Path, x: np.ndarray) -> np.ndarray:
    import onnxruntime as ort

    session = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
    return session.run(None, {"input": x.astype(np.float32)})[0]


def quantize_int8(src: Path, dst: Path) -> tuple[bool, str]:
    try:
        from onnxruntime.quantization import QuantType, quantize_dynamic

        quantize_dynamic(str(src), str(dst), weight_type=QuantType.QInt8)
        return True, "onnxruntime.quantization.quantize_dynamic"
    except Exception as exc:  # pragma: no cover - depends on ORT build
        return False, f"{type(exc).__name__}: {exc}"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dataset", choices=sorted(DATASETS), default="pushupbench")
    ap.add_argument("--epochs", type=int, default=60)
    ap.add_argument("--patience", type=int, default=10)
    ap.add_argument("--batch-size", type=int, default=64)
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--min-subjects", type=int, default=MIN_SUBJECTS_PER_CLASS)
    ap.add_argument("--dry-run", action="store_true", help="build splits and print counts only")
    args = ap.parse_args()

    spec = dict(DATASETS[args.dataset])
    spec["_mapping"] = {
        k.lower().strip(): v
        for k, v in json.loads(spec["mapping"].read_text()).items()
    }

    np.random.seed(args.seed)
    torch.manual_seed(args.seed)

    x, labels, subjects, stems = load_windows(spec["keypoints"], spec)

    # Only classes with enough distinct subjects to be split without leakage.
    subjects_by_class: dict[str, set[str]] = collections.defaultdict(set)
    for label, subject in zip(labels, subjects):
        subjects_by_class[label].add(subject)
    keep = sorted(c for c in subjects_by_class if len(subjects_by_class[c]) >= args.min_subjects)
    excluded = sorted(set(subjects_by_class) - set(keep))
    if not keep:
        raise SystemExit(f"no class has >= {args.min_subjects} subjects")

    assignment, dropped = assign_splits(labels, subjects, args.seed)
    if dropped:
        print(f"dropped for missing split coverage: {dropped}")
    keep = [c for c in keep if c not in dropped]
    excluded = sorted(set(subjects_by_class) - set(keep))
    if not keep:
        raise SystemExit(
            "every eligible class failed subject-disjoint split coverage; "
            "extract more subjects or lower --min-subjects"
        )

    classes = sorted(keep)
    class_to_idx = {c: i for i, c in enumerate(classes)}
    keep_mask = np.isin(labels, classes)
    labels = labels[keep_mask]
    subjects = subjects[keep_mask]
    stems = stems[keep_mask]
    x = x[keep_mask]
    y = np.asarray([class_to_idx[c] for c in labels])

    splits: dict[str, list[int]] = {s: [] for s in SPLITS}
    for i, subject in enumerate(subjects):
        splits[assignment[subject]].append(i)
    empty = [s for s in SPLITS if not splits[s]]
    if empty:
        raise SystemExit(f"empty split(s): {empty}; add more subjects or lower --min-subjects")
    missing = [
        c for c in classes
        if not all(any(labels[i] == c for i in splits[s]) for s in SPLITS)
    ]
    if missing:
        raise SystemExit(f"class(es) missing from a split: {missing}")

    summary = {
        "classes": classes,
        "excluded_classes": excluded,
        "excluded_reason": (
            f"fewer than {args.min_subjects} distinct subjects: cannot hold out a "
            "subject without leaking identical footage between train and test"
        ),
        "windows_total": int(len(x)),
        "windows_per_split": {s: len(v) for s, v in splits.items()},
        "subjects_per_split": {
            s: len({subjects[i] for i in idx}) for s, idx in splits.items()
        },
        "videos_per_split": {
            s: len({stems[i] for i in idx}) for s, idx in splits.items()
        },
    }
    print(json.dumps(summary, indent=2))
    if args.dry_run:
        return 0

    loaders = {
        "train": DataLoader(WindowDataset(x[splits["train"]], y[splits["train"]], augment=True),
                            batch_size=args.batch_size, shuffle=True, drop_last=len(splits["train"]) > args.batch_size),
        "val": DataLoader(WindowDataset(x[splits["val"]], y[splits["val"]], augment=False), batch_size=256),
        "test": DataLoader(WindowDataset(x[splits["test"]], y[splits["test"]], augment=False), batch_size=256),
    }

    model = CNN1DClassifier(input_channels=FEATURES, num_classes=len(classes))
    counts = np.bincount(y[splits["train"]], minlength=len(classes)).astype(np.float64)
    weights = torch.tensor((counts.sum() / (len(classes) * np.maximum(counts, 1))), dtype=torch.float32)
    criterion = nn.CrossEntropyLoss(weight=weights, label_smoothing=0.05)
    optimiser = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)

    best_f1, best_state, best_epoch, stale = -1.0, None, 0, 0
    history = []
    for epoch in range(1, args.epochs + 1):
        model.train()
        total_loss = 0.0
        for xb, yb in loaders["train"]:
            optimiser.zero_grad()
            loss = criterion(model(xb), yb)
            loss.backward()
            optimiser.step()
            total_loss += float(loss) * len(xb)
        val_acc, val_f1, _, _ = evaluate(model, loaders["val"])
        history.append({"epoch": epoch, "train_loss": round(total_loss / len(splits["train"]), 4),
                        "val_acc": round(val_acc, 4), "val_macro_f1": round(val_f1, 4)})
        print(f"epoch {epoch:3d} loss {total_loss / len(splits['train']):.4f} "
              f"val_acc {val_acc:.4f} val_macro_f1 {val_f1:.4f}", flush=True)
        if val_f1 > best_f1 + 1e-4:
            best_f1, best_epoch, stale = val_f1, epoch, 0
            best_state = {k: v.detach().clone() for k, v in model.state_dict().items()}
        else:
            stale += 1
            if stale >= args.patience:
                print(f"early stop at epoch {epoch} (best {best_epoch})")
                break

    if best_state is None:
        raise SystemExit("training produced no checkpoint")
    model.load_state_dict(best_state)

    test_acc, test_f1, pred, target = evaluate(model, loaders["test"])
    precision, recall, f1, support = precision_recall_fscore_support(
        target, pred, labels=list(range(len(classes))), zero_division=0
    )
    per_class = {
        cls: {
            "precision": round(float(precision[i]), 4),
            "recall": round(float(recall[i]), 4),
            "f1": round(float(f1[i]), 4),
            "support": int(support[i]),
        }
        for i, cls in enumerate(classes)
    }
    print(f"\nTEST accuracy {test_acc:.4f} macro_f1 {test_f1:.4f}")

    out_dir: Path = spec["out"]
    out_dir.mkdir(parents=True, exist_ok=True)
    onnx_path = out_dir / "cnn1d.onnx"
    int8_path = out_dir / "cnn1d_int8.onnx"
    export_onnx(model, onnx_path)

    sample = x[splits["test"]][:64]
    torch_logits = model(torch.from_numpy(sample)).detach().numpy()
    parity = float(np.abs(torch_logits - ort_logits(onnx_path, sample)).max())

    int8_ok, int8_note = quantize_int8(onnx_path, int8_path)
    int8_metrics = None
    if int8_ok:
        all_logits = ort_logits(int8_path, x[splits["test"]])
        int8_metrics = {
            "accuracy": round(float((all_logits.argmax(1) == target).mean()), 4),
            "macro_f1": round(float(f1_score(target, all_logits.argmax(1), average="macro", zero_division=0)), 4),
            "size_bytes": int8_path.stat().st_size,
            "delta_macro_f1_vs_float": round(
                float(f1_score(target, all_logits.argmax(1), average="macro", zero_division=0)) - test_f1, 4
            ),
        }
    else:
        print(f"int8 quantisation unavailable: {int8_note}")

    manifest = {
        "model": "pattern_cnn1d",
        "version": "1.0.0",
        "status": "trained on real, licence-cleared recordings",
        "dataset": spec["source"],
        "license": spec["license"],
        "attribution_required": True,
        "feature_spec": "ml/FEATURE_SPEC.md",
        "preprocessing": "FEATURE_SPEC pad 1.5 -> unpad -> mid-hip/torso normalise -> 15 fps",
        "input": {"shape": [1, WINDOW, FEATURES], "window_frames": WINDOW, "stride": STRIDE},
        "classes": classes,
        "excluded_classes": excluded,
        "excluded_reason": summary["excluded_reason"],
        "counts": {k: summary[k] for k in ("windows_total", "windows_per_split", "subjects_per_split")},
        "seed": args.seed,
        "epochs_run": len(history),
        "best_epoch": best_epoch,
        "best_val_macro_f1": round(best_f1, 4),
        "test": {
            "accuracy": round(test_acc, 4),
            "macro_f1": round(test_f1, 4),
            "per_class": per_class,
            "confusion_matrix": confusion_matrix(target, pred, labels=list(range(len(classes)))).tolist(),
        },
        "int8": int8_metrics,
        "torch_onnx_max_abs_diff": parity,
        "parameters": count_parameters(model),
        "files": {
            "cnn1d.onnx": {"sha256": sha256(onnx_path), "bytes": onnx_path.stat().st_size},
            **({"cnn1d_int8.onnx": {"sha256": sha256(int8_path), "bytes": int8_path.stat().st_size}} if int8_ok else {}),
        },
        "scope_limits": [
            "Covers only patterns present in licence-cleared recordings; horizontal_pull is absent.",
            "Metrics are within-dataset (PushUpBench subjects), not PhysiqueQuest users.",
            "No claim is made for rep counting; this model classifies movement pattern only.",
        ],
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))
    (spec["report"]).write_text(json.dumps({"summary": summary, "history": history, "manifest": manifest}, indent=2))

    print(f"model      {onnx_path} ({onnx_path.stat().st_size} bytes)")
    if int8_ok:
        print(f"int8       {int8_path} ({int8_path.stat().st_size} bytes, "
              f"macro_f1 {int8_metrics['macro_f1']})")
    print(f"parity     max |torch - onnx| = {parity:.2e}")
    print(f"manifest   {out_dir / 'manifest.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
