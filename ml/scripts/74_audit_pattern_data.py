#!/usr/bin/env python3
"""Audit the extracted PushUpBench dataset (Phase 2).

Checks the data, not the model:
  labels        every exercise name -> pattern, exported for human review
  keypoints     detection rate, visibility, degenerate frames, zero-filled slots
  video         duration, fps, resolution, portrait/landscape, static clips
  reps          annotated rep count vs peaks in the dominant joint signal
  diversity     subject x class coverage, duplicate sequences, multi-set clips

Writes reports/pattern_v1_data_audit.json, reports/label_review.csv and
reports/PATTERN_V1_DATA_AUDIT.md.
"""
from __future__ import annotations

import collections
import csv
import hashlib
import json
from pathlib import Path

import numpy as np
from scipy.signal import find_peaks

ML = Path(__file__).resolve().parents[1]
KEYPOINTS = ML / "data" / "keypoints_pushupbench"
RAW = ML / "data" / "raw" / "real_video" / "pushupbench"
MAPPING = ML / "configs" / "pushupbench_taxonomy_mapping.json"
PATTERN = __import__("re").compile(r"^([0-9a-f]{8,})_\d+_(.+?)_\[([0-9\-]+)\]$")
KEY_JOINTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]


def parse(stem: str):
    m = PATTERN.match(stem)
    if not m:
        return None
    group, name, reps = m.groups()
    return group, name, [int(x) for x in reps.split("-")]


def dominant_rep_count(seq: np.ndarray, fps: float = 15.0) -> tuple[int, str]:
    """Count peaks in the highest-range joint axis, a proxy for movement reps."""
    xy = seq[:, :, :2]
    rng = xy.max(axis=0) - xy.min(axis=0)
    joint, axis = np.unravel_index(rng.argmax(), rng.shape)
    signal = xy[:, joint, axis].astype(np.float64)
    if signal.size >= 5:
        signal = np.convolve(signal, np.ones(5) / 5.0, mode="same")
    span = float(signal.max() - signal.min())
    if span < 1e-3:
        return 0, f"joint{joint}{'xy'[axis]}(static)"
    peaks, _ = find_peaks(
        signal,
        prominence=0.25 * span,
        distance=max(2, int(0.4 * fps)),
    )
    return int(len(peaks)), f"joint{joint}{'xy'[axis]}"


def main() -> int:
    mapping = {k.lower().strip(): v for k, v in json.loads(MAPPING.read_text()).items()}
    files = sorted(KEYPOINTS.glob("*.npz"))
    rows = []
    sequences = {}
    for path in files:
        meta = parse(path.stem)
        data = np.load(path)
        lm = data["landmarks"].astype(np.float32)
        det = data["detection_mask"].astype(bool)
        duration = float(data["timestamps_ms"][-1] - data["timestamps_ms"][0]) / 1000.0
        vis = lm[:, :, 3]
        key_vis = vis[:, KEY_JOINTS].mean()
        zero = (np.abs(lm) < 1e-9).all(axis=2).mean()
        reps_peaks, signal_name = dominant_rep_count(lm)
        row = {
            "stem": path.stem,
            "subject": meta[0] if meta else "",
            "exercise": meta[1] if meta else "",
            "pattern": mapping.get(meta[1].lower().strip(), "") if meta else "",
            "gt_reps": sum(meta[2]) if meta else 0,
            "sets": len(meta[2]) if meta else 0,
            "frames": int(lm.shape[0]),
            "duration_s": round(duration, 2),
            "fps": round(float(data["fps"]), 2),
            "width": int(data["width"]),
            "height": int(data["height"]),
            "source_width": int(data["source_width"]),
            "source_height": int(data["source_height"]),
            "orientation": "portrait" if data["source_height"] > data["source_width"] else "landscape",
            "detected_pct": round(100.0 * float(det.mean()), 2),
            "key_visibility": round(float(key_vis), 4),
            "zero_joint_frac": round(float(zero), 5),
            "signal_peaks": reps_peaks,
            "signal_joint": signal_name,
            "motion": round(float(np.abs(np.diff(lm[:, :, :2], axis=0)).mean()), 5),
        }
        rows.append(row)
        sequences[path.stem] = hashlib.sha256(lm.tobytes()).hexdigest()

    # ---- label review csv ----
    review = ML / "reports" / "label_review.csv"
    with review.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    # ---- keypoint / video health ----
    def stats(values, nd=3):
        a = np.asarray(values, dtype=np.float64)
        return {
            "min": round(float(a.min()), nd),
            "p10": round(float(np.percentile(a, 10)), nd),
            "median": round(float(np.median(a)), nd),
            "p90": round(float(np.percentile(a, 90)), nd),
            "max": round(float(a.max()), nd),
            "mean": round(float(a.mean()), nd),
        }

    low_det = [r for r in rows if r["detected_pct"] < 90]
    low_vis = [r for r in rows if r["key_visibility"] < 0.6]
    static = [r for r in rows if r["motion"] < 0.005]
    short = [r for r in rows if r["frames"] < 48]

    health = {
        "videos": len(rows),
        "detected_pct": stats([r["detected_pct"] for r in rows], 2),
        "key_visibility": stats([r["key_visibility"] for r in rows], 3),
        "zero_joint_frac": stats([r["zero_joint_frac"] for r in rows], 5),
        "duration_s": stats([r["duration_s"] for r in rows], 2),
        "fps": dict(collections.Counter(r["fps"] for r in rows)),
        "orientation": dict(collections.Counter(r["orientation"] for r in rows)),
        "resolution": dict(collections.Counter(f'{r["source_width"]}x{r["source_height"]}' for r in rows)),
        "videos_below_90pct_detection": len(low_det),
        "videos_below_0.6_key_visibility": len(low_vis),
        "videos_static_motion": len(static),
        "videos_shorter_than_window": len(short),
        "static_examples": [r["stem"] for r in static[:5]],
        "low_detection_examples": [(r["stem"], r["detected_pct"]) for r in low_det[:5]],
    }

    # ---- rep annotation vs signal ----
    single = [r for r in rows if r["sets"] == 1 and r["gt_reps"] > 0]
    diffs = np.asarray([r["signal_peaks"] - r["gt_reps"] for r in single])
    per_class_rep = {}
    for cls in sorted(set(r["pattern"] for r in rows)):
        sub = [r for r in single if r["pattern"] == cls]
        if not sub:
            continue
        d = np.asarray([r["signal_peaks"] - r["gt_reps"] for r in sub])
        per_class_rep[cls] = {
            "videos": len(sub),
            "median_abs_error": round(float(np.median(np.abs(d))), 2),
            "within_1_share": round(float((np.abs(d) <= 1).mean()), 3),
            "median_gt_reps": round(float(np.median([r["gt_reps"] for r in sub])), 1),
            "median_detected_peaks": round(float(np.median([r["signal_peaks"] for r in sub])), 1),
        }
    reps = {
        "single_set_videos": len(single),
        "multi_set_videos": sum(1 for r in rows if r["sets"] > 1),
        "median_abs_error_peaks_vs_gt": round(float(np.median(np.abs(diffs))), 2),
        "within_1_share": round(float((np.abs(diffs) <= 1).mean()), 3),
        "pearson_r": round(float(np.corrcoef([r["signal_peaks"] for r in single], [r["gt_reps"] for r in single])[0, 1]), 3),
        "per_class": per_class_rep,
        "note": "Peaks in the highest-range joint axis are a crude proxy; disagreement is a flag for review, not proof of a wrong label.",
    }

    # ---- duplicates and coverage ----
    hash_counts = collections.Counter(sequences.values())
    dup_hashes = [h for h, c in hash_counts.items() if c > 1]
    by_name_subject = collections.Counter((r["subject"], r["exercise"].lower()) for r in rows)
    repeats = {f"{k[0][:8]}|{k[1]}": v for k, v in by_name_subject.items() if v > 1}

    coverage = {
        "videos": len(rows),
        "subjects": len(set(r["subject"] for r in rows)),
        "subject_prefixes_8": len(set(r["subject"][:8] for r in rows)),
        "alias_collisions": sorted(
            {
                f"{a[:8]}->{a}"
                for a in set(r["subject"] for r in rows)
                if any(b != a and b.startswith(a[:8]) and len(b) > len(a) for b in set(x["subject"] for x in rows))
            }
        ),
        "per_pattern": {
            cls: {
                "videos": sum(1 for r in rows if r["pattern"] == cls),
                "subjects": len({r["subject"][:8] for r in rows if r["pattern"] == cls}),
                "median_duration_s": round(float(np.median([r["duration_s"] for r in rows if r["pattern"] == cls])), 1),
                "median_gt_reps": round(float(np.median([r["gt_reps"] for r in rows if r["pattern"] == cls])), 1),
                "portrait": sum(1 for r in rows if r["pattern"] == cls and r["orientation"] == "portrait"),
                "landscape": sum(1 for r in rows if r["pattern"] == cls and r["orientation"] == "landscape"),
            }
            for cls in sorted(set(r["pattern"] for r in rows))
        },
        "duplicate_sequence_hashes": len(dup_hashes),
        "same_subject_same_exercise_repeats": repeats,
        "subjects_with_multiple_patterns": sum(
            1 for s in set(r["subject"][:8] for r in rows)
            if len({r["pattern"] for r in rows if r["subject"][:8] == s}) > 1
        ),
        "exercises_per_pattern": {
            cls: sorted({r["exercise"] for r in rows if r["pattern"] == cls})
            for cls in sorted(set(r["pattern"] for r in rows))
        },
    }

    audit = {"health": health, "reps": reps, "coverage": coverage}
    out_json = ML / "reports" / "pattern_v1_data_audit.json"
    out_json.write_text(json.dumps(audit, indent=2, default=str))

    print(json.dumps(health, indent=2)[:1200])
    print(json.dumps(reps, indent=2))
    print("coverage:", json.dumps({k: v for k, v in coverage.items() if k != "exercises_per_pattern"}, indent=2))
    print(f"wrote {out_json} and {review}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
