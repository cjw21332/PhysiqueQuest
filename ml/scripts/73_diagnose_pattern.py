#!/usr/bin/env python3
"""Diagnose pattern_v1: why is held-out accuracy 0.469 / macro-F1 0.36?

Every number here is computed from artefacts that already exist:
  - ml/data/keypoints_pushupbench/*.npz   (FEATURE_SPEC preprocessing output)
  - ml/models/pattern_v1/cnn1d.onnx       (the trained float model)
  - the split logic in scripts/72_train_pattern.py (imported, not re-implemented)

Outputs reports/pattern_v1_diagnosis.json plus a printed summary.

Sections
  A splits       class/ subject/ video distribution per split, imbalance
  B model        per-split, per-class, per-subject, per-video metrics
  C confusion    normalised confusion + top confusions
  D windows      motion energy, ROM, detection rate, zero-filled frames
  E baselines    majority class, train-centroid nearest neighbour
  F provenance   multi-set clips, subject x class coverage, duplicate stems
"""
from __future__ import annotations

import collections
import importlib.util
import json
import sys
from pathlib import Path

import numpy as np

ML = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ML / "src"))

SPEC = importlib.util.spec_from_file_location("train72", ML / "scripts" / "72_train_pattern.py")
train = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(train)

MODEL = ML / "models" / "pattern_v1" / "cnn1d.onnx"
SEED = 7
KEY_JOINTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]


def load_split_data():
    """Rebuild exactly what 72_train_pattern.py trained on."""
    spec = dict(train.DATASETS["pushupbench"])
    spec["_mapping"] = {
        k.lower().strip(): v for k, v in json.loads(spec["mapping"].read_text()).items()
    }
    x, labels, subjects, stems = train.load_windows(spec["keypoints"], spec)

    by_class = collections.defaultdict(set)
    for label, subject in zip(labels, subjects):
        by_class[label].add(subject)
    keep = sorted(c for c in by_class if len(by_class[c]) >= train.MIN_SUBJECTS_PER_CLASS)
    assignment, dropped = train.assign_splits(labels, subjects, SEED)
    keep = [c for c in keep if c not in dropped]
    classes = sorted(keep)
    idx = {c: i for i, c in enumerate(classes)}

    mask = np.isin(labels, classes)
    x, labels, subjects, stems = x[mask], labels[mask], subjects[mask], stems[mask]
    y = np.asarray([idx[c] for c in labels])
    split_of = np.asarray([assignment[s] for s in subjects])

    meta = {}
    for npz in sorted(spec["keypoints"].glob("*.npz")):
        m = train.parse_meta(npz, spec)
        if m is not None:
            meta[m["stem"]] = m
    return {
        "x": x,
        "y": y,
        "labels": labels,
        "subjects": subjects,
        "stems": stems,
        "split_of": split_of,
        "classes": classes,
        "assignment": assignment,
        "meta": meta,
        "excluded": sorted(set(train.parse_meta(p, spec)["pattern"] for p in spec["keypoints"].glob("*.npz") if train.parse_meta(p, spec)) - set(classes)),
    }


def predict(x: np.ndarray, batch: int = 512) -> np.ndarray:
    import onnxruntime as ort

    session = ort.InferenceSession(str(MODEL), providers=["CPUExecutionProvider"])
    out = []
    for start in range(0, len(x), batch):
        out.append(session.run(None, {"input": x[start:start + batch].astype(np.float32)})[0])
    return np.concatenate(out).argmax(1)


def window_stats(x: np.ndarray) -> dict:
    """Motion/quality descriptors per window (x is [N, T, 132])."""
    seq = x.reshape(len(x), train.WINDOW, 33, 4)
    xy = seq[:, :, :, :2]
    d = np.abs(np.diff(xy, axis=1))  # [N, T-1, 33, 2]
    motion = d.mean(axis=(1, 2, 3))
    key = xy[:, :, KEY_JOINTS, :]
    rom = (np.percentile(key, 95, axis=1) - np.percentile(key, 5, axis=1)).mean(axis=(1, 2))
    # Fraction of joint-slots that are exactly zero (a frame MediaPipe missed),
    # which resampling turns into interpolated garbage rather than a clean gap.
    zero_frac = (np.abs(seq) < 1e-9).all(axis=3).mean(axis=(1, 2))
    return {"motion": motion, "rom": rom, "zero_frac": zero_frac}


def metrics(y_true, y_pred, n_classes):
    from sklearn.metrics import accuracy_score, f1_score, precision_recall_fscore_support

    p, r, f, s = precision_recall_fscore_support(
        y_true, y_pred, labels=list(range(n_classes)), zero_division=0
    )
    return {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "macro_f1": round(float(f1_score(y_true, y_pred, average="macro", zero_division=0)), 4),
        "per_class": {
            i: {
                "precision": round(float(p[i]), 4),
                "recall": round(float(r[i]), 4),
                "f1": round(float(f[i]), 4),
                "support": int(s[i]),
            }
            for i in range(n_classes)
        },
    }


def main() -> int:
    d = load_split_data()
    classes, y, split_of, subjects, stems = d["classes"], d["y"], d["split_of"], d["subjects"], d["stems"]
    n_classes = len(classes)
    pred = predict(d["x"])
    stats = window_stats(d["x"])
    report: dict = {"model": str(MODEL.relative_to(ML)), "seed": SEED, "classes": classes}

    # ---------- A. splits ----------
    dist = {}
    for split in ("train", "val", "test"):
        m = split_of == split
        dist[split] = {
            "windows": int(m.sum()),
            "subjects": sorted(set(subjects[m])),
            "videos": int(len(set(stems[m]))),
            "per_class_windows": {c: int(((y == i) & m).sum()) for i, c in enumerate(classes)},
            "per_class_subjects": {
                c: sorted(set(subjects[m & (y == i)])) for i, c in enumerate(classes)
            },
        }
    counts = np.bincount(y[split_of == "train"], minlength=n_classes)
    dist["imbalance"] = {
        "train_windows_min": int(counts.min()),
        "train_windows_max": int(counts.max()),
        "ratio_max_over_min": round(float(counts.max() / max(counts.min(), 1)), 2),
        "class_weights_applied": [round(float(counts.sum() / (n_classes * max(c, 1))), 3) for c in counts],
    }
    report["splits"] = dist

    # ---------- B. model metrics ----------
    report["model_metrics"] = {
        split: metrics(y[split_of == split], pred[split_of == split], n_classes)
        for split in ("train", "val", "test")
    }
    per_subject = {}
    for subject in sorted(set(subjects[split_of == "test"])):
        m = (subjects == subject) & (split_of == "test")
        entry = metrics(y[m], pred[m], n_classes)
        entry["classes_present"] = sorted(set(classes[i] for i in np.unique(y[m])))
        entry["windows"] = int(m.sum())
        entry["videos"] = int(len(set(stems[m])))
        per_subject[subject] = entry
    report["test_subjects"] = per_subject
    per_video = {}
    for stem in sorted(set(stems[split_of == "test"])):
        m = (stems == stem) & (split_of == "test")
        per_video[stem] = {
            "pattern": classes[int(y[m][0])],
            "accuracy": round(float((pred[m] == y[m]).mean()), 4),
            "windows": int(m.sum()),
        }
    report["test_videos"] = per_video

    # ---------- C. confusion ----------
    from sklearn.metrics import confusion_matrix

    tm = split_of == "test"
    cm = confusion_matrix(y[tm], pred[tm], labels=list(range(n_classes)))
    row_norm = cm / np.maximum(cm.sum(axis=1, keepdims=True), 1)
    report["confusion"] = {
        "labels": classes,
        "raw": cm.tolist(),
        "row_normalised": np.round(row_norm, 3).tolist(),
        "top_confusions": sorted(
            (
                {"true": classes[i], "pred": classes[j], "count": int(cm[i, j]),
                 "share_of_true": round(float(row_norm[i, j]), 3)}
                for i in range(n_classes) for j in range(n_classes) if i != j and cm[i, j] > 0
            ),
            key=lambda r: -r["count"],
        )[:10],
    }

    # ---------- D. window signal ----------
    def bucket(subset_mask, label):
        return {
            "windows": int(subset_mask.sum()),
            "accuracy": round(float((pred[subset_mask] == y[subset_mask]).mean()), 4) if subset_mask.any() else None,
            "motion_mean": round(float(stats["motion"][subset_mask].mean()), 4) if subset_mask.any() else None,
        }

    stat_summary = {}
    for name, values in stats.items():
        q = np.percentile(values, [10, 25, 50, 75, 90])
        stat_summary[name] = {
            "p10": round(float(q[0]), 4), "p25": round(float(q[1]), 4), "p50": round(float(q[2]), 4),
            "p75": round(float(q[3]), 4), "p90": round(float(q[4]), 4),
            "mean": round(float(values.mean()), 4),
        }
    motion_q = np.percentile(stats["motion"], [25, 50, 75])
    report["windows"] = {
        "summary": stat_summary,
        "test_accuracy_by_motion_quartile": {
            "q1_lowest": bucket(tm & (stats["motion"] <= motion_q[0]), "q1"),
            "q2": bucket(tm & (stats["motion"] > motion_q[0]) & (stats["motion"] <= motion_q[1]), "q2"),
            "q3": bucket(tm & (stats["motion"] > motion_q[1]) & (stats["motion"] <= motion_q[2]), "q3"),
            "q4_highest": bucket(tm & (stats["motion"] > motion_q[2]), "q4"),
        },
        "test_accuracy_by_zero_frac": {
            "clean": bucket(tm & (stats["zero_frac"] == 0), "clean"),
            "some_zero": bucket(tm & (stats["zero_frac"] > 0) & (stats["zero_frac"] < 0.1), "some"),
            "gt_10pct_zero": bucket(tm & (stats["zero_frac"] >= 0.1), "bad"),
        },
        "test_accuracy_by_rom": {
            "low": bucket(tm & (stats["rom"] < np.median(stats["rom"])), "low"),
            "high": bucket(tm & (stats["rom"] >= np.median(stats["rom"])), "high"),
        },
    }

    # ---------- E. baselines ----------
    trm = split_of == "train"
    prior = np.bincount(y[trm], minlength=n_classes).argmax()
    xf = d["x"].reshape(len(d["x"]), -1).astype(np.float32)
    centroids = np.stack([xf[trm & (y == i)].mean(axis=0) for i in range(n_classes)])
    # Squared distance via the expansion, avoiding a [N, C, D] intermediate.
    test_x = xf[tm]
    centroid_pred = (
        (test_x ** 2).sum(1)[:, None]
        - 2.0 * test_x @ centroids.T
        + (centroids ** 2).sum(1)[None, :]
    ).argmin(1)
    report["baselines"] = {
        "majority_class": classes[int(prior)],
        "majority_test_accuracy": round(float((y[tm] == prior).mean()), 4),
        "train_centroid_nn_test_accuracy": round(float((centroid_pred == y[tm]).mean()), 4),
        "train_centroid_nn_test_macro_f1": round(
            float(__import__("sklearn.metrics", fromlist=["f1_score"]).f1_score(
                y[tm], centroid_pred, average="macro", zero_division=0)), 4),
        "model_test_accuracy": report["model_metrics"]["test"]["accuracy"],
        "model_test_macro_f1": report["model_metrics"]["test"]["macro_f1"],
    }

    # ---------- F. provenance / label checks ----------
    meta = d["meta"]
    multi_set = [m["stem"] for m in meta.values() if len(m["gt_reps"]) > 1]
    subject_classes = collections.defaultdict(set)
    for label, subject in zip(d["labels"], subjects):
        subject_classes[subject].add(label)
    dup_names = collections.Counter(m["exercise"].lower().strip() for m in meta.values())
    report["provenance"] = {
        "videos_total": len(meta),
        "videos_multi_set": len(multi_set),
        "multi_set_examples": sorted(multi_set)[:5],
        "subjects_total": len(subject_classes),
        "classes_per_subject": {
            s: len(v) for s, v in sorted(subject_classes.items())
        },
        "subjects_with_multiple_classes": sum(1 for v in subject_classes.values() if len(v) > 1),
        "duplicate_exercise_names": {
            k: v for k, v in dup_names.items() if v > 1
        },
        "excluded_classes": d["excluded"],
        "class_video_counts": dict(collections.Counter(m["pattern"] for m in meta.values())),
        "class_subject_counts": {
            c: len({m["subject"] for m in meta.values() if m["pattern"] == c}) for c in sorted(set(m["pattern"] for m in meta.values()))
        },
    }

    # ---------- G. perturbation robustness on held-out windows ----------
    def apply_xy(x: np.ndarray, fn) -> np.ndarray:
        seq = x.reshape(len(x), train.WINDOW, 33, 4).copy()
        seq[:, :, :, :2] = fn(seq[:, :, :, :2])
        return seq.reshape(len(x), train.WINDOW, train.FEATURES)

    def rotate(angle_deg: float):
        rad = np.deg2rad(angle_deg)
        c, s = np.cos(rad), np.sin(rad)

        def fn(xy):
            out = xy.copy()
            out[..., 0] = xy[..., 0] * c - xy[..., 1] * s
            out[..., 1] = xy[..., 0] * s + xy[..., 1] * c
            return out
        return fn

    def mirror(xy):
        out = xy.copy()
        out[..., 0] *= -1.0
        for a, b in train.FLIP_PAIRS:
            out[:, :, [a, b]] = out[:, :, [b, a]]
        return out

    def scale_xy(fx: float, fy: float):
        def fn(xy):
            out = xy.copy()
            out[..., 0] *= fx
            out[..., 1] *= fy
            return out
        return fn

    test_x = d["x"][tm]
    perturbations = {
        "identity": test_x,
        "mirrored": apply_xy(test_x, mirror),
        "rotate_+10deg": apply_xy(test_x, rotate(10.0)),
        "rotate_+20deg": apply_xy(test_x, rotate(20.0)),
        "rotate_-20deg": apply_xy(test_x, rotate(-20.0)),
        "scale_x_1.15": apply_xy(test_x, scale_xy(1.15, 1.0)),
        "scale_y_0.85": apply_xy(test_x, scale_xy(1.0, 0.85)),
        "time_reversed": test_x.reshape(len(test_x), train.WINDOW, 33, 4)[:, ::-1].reshape(
            len(test_x), train.WINDOW, train.FEATURES
        ),
        # If a single repeated frame scores like the real window, the network is
        # classifying static pose and cannot be reading movement at all.
        "single_frame_repeated": np.repeat(
            test_x.reshape(len(test_x), train.WINDOW, 33, 4)[:, train.WINDOW // 2: train.WINDOW // 2 + 1],
            train.WINDOW, axis=1,
        ).reshape(len(test_x), train.WINDOW, train.FEATURES),
    }
    report["perturbation_robustness"] = {
        name: round(float((predict(xp) == y[tm]).mean()), 4)
        for name, xp in perturbations.items()
    }

    # ---------- H. variance decomposition: subject vs class signal ----------
    xf_all = d["x"].reshape(len(d["x"]), -1).astype(np.float64)
    mean_pose = xf_all.reshape(len(xf_all), train.WINDOW, 132).mean(axis=1)

    def fisher(values: np.ndarray, groups: np.ndarray) -> dict:
        overall = values.mean(axis=0)
        between = 0.0
        within = 0.0
        for g in np.unique(groups):
            m = groups == g
            gm = values[m].mean(axis=0)
            between += m.sum() * float(((gm - overall) ** 2).sum())
            within += float(((values[m] - gm) ** 2).sum())
        n = len(values)
        k = len(np.unique(groups))
        return {
            "groups": int(k),
            "between_var_per_dim": round(float(between / max(k - 1, 1) / values.shape[1]), 6),
            "within_var_per_dim": round(float(within / max(n - k, 1) / values.shape[1]), 6),
            "fisher_ratio": round(float((between / max(k - 1, 1)) / max(within / max(n - k, 1), 1e-9)), 3),
        }

    report["variance_decomposition"] = {
        "by_class": fisher(mean_pose, y),
        "by_subject": fisher(mean_pose, subjects),
        # Subject identity after removing the class mean: if this stays high, the
        # representation carries person/camera cues independent of the movement.
        "by_subject_within_class_residual": fisher(
            mean_pose - np.stack([mean_pose[y == i].mean(axis=0) for i in range(n_classes)])[y],
            subjects,
        ),
    }

    out = ML / "reports" / "pattern_v1_diagnosis.json"
    out.write_text(json.dumps(report, indent=2, default=str))

    # ---------- printed summary ----------
    print(f"classes: {classes}")
    print(f"{'split':6} {'win':>6} {'subj':>5} {'vid':>4} {'acc':>6} {'f1':>6}")
    for split in ("train", "val", "test"):
        m = report["model_metrics"][split]
        print(f"{split:6} {dist[split]['windows']:6d} {len(dist[split]['subjects']):5d} "
              f"{dist[split]['videos']:4d} {m['accuracy']:6.3f} {m['macro_f1']:6.3f}")
    print("\nper class (test):")
    for i, c in enumerate(classes):
        pc = report["model_metrics"]["test"]["per_class"][i]
        print(f"  {c:17} P {pc['precision']:.3f} R {pc['recall']:.3f} F1 {pc['f1']:.3f} n={pc['support']}")
    print("\ntest subjects:")
    for s, e in per_subject.items():
        print(f"  {s[:8]} n={e['windows']:4d} acc={e['accuracy']:.3f} f1={e['macro_f1']:.3f} "
              f"classes={len(e['classes_present'])}")
    print(f"\nbaselines: majority={report['baselines']['majority_test_accuracy']:.3f} "
          f"centroidNN={report['baselines']['train_centroid_nn_test_accuracy']:.3f} "
          f"model={report['baselines']['model_test_accuracy']:.3f}")
    print(f"windows: motion p50={stat_summary['motion']['p50']:.4f} "
          f"rom p50={stat_summary['rom']['p50']:.3f} zero_frac p50={stat_summary['zero_frac']['p50']:.3f}")
    print("\nperturbation accuracy:", report["perturbation_robustness"])
    print("variance decomposition:", json.dumps(report["variance_decomposition"]))
    print(f"wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
