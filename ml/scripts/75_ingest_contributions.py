#!/usr/bin/env python3
"""Ingest a reviewed contribution export into training-ready keypoint files.

Input  : backend/scripts/export-dataset.mjs output (manifest.json + <pattern>/<id>.json)
Output : ml/data/keypoints_contributions/<clipId>.npz  (landmarks, timestamps_ms,
         detection_mask, normalized, pad_factor) and
         ml/data/manifests/contributions_<version>.json

The export is expected to be pseudonymous. This script refuses to run if an
identity field is present, so a mistaken export cannot enter the training set.
"""
from __future__ import annotations

import argparse
import collections
import json
from pathlib import Path

import numpy as np

ML = Path(__file__).resolve().parents[1]
FORBIDDEN = {"userId", "userid", "email", "displayName", "passwordHash", "_id"}
FEATURES = 132


def load_export(root: Path) -> tuple[dict, list[dict]]:
    manifest = json.loads((root / "manifest.json").read_text())
    if "clips" not in manifest or "files" not in manifest:
        raise SystemExit(f"{root}/manifest.json is not a contribution export")
    records = []
    for entry in manifest["files"]:
        path = root / entry["file"]
        body = json.loads(path.read_text())
        leaked = FORBIDDEN.intersection(body)
        if leaked:
            raise SystemExit(f"{path} contains identity fields: {sorted(leaked)}")
        records.append(body)
    return manifest, records


def to_npz(body: dict, out_dir: Path) -> dict:
    payload = body["payload"]
    frames = np.asarray(payload["frames"], dtype=np.float32)
    if frames.ndim != 2 or frames.shape[1] != FEATURES:
        raise SystemExit(f"{body['clipId']}: frames must be N x {FEATURES}, got {frames.shape}")
    landmarks = frames.reshape(len(frames), 33, 4)
    timestamps = np.asarray(payload["timestampsMs"], dtype=np.float64)
    detected = ~(np.abs(landmarks[:, :, :3]).sum(axis=(1, 2)) == 0)
    out = out_dir / f"{body['clipId']}.npz"
    np.savez_compressed(
        out,
        landmarks=landmarks,
        timestamps_ms=timestamps,
        detection_mask=detected,
        normalized=True,
        pad_factor=1.5,
    )
    annotation = body.get("annotation") or {}
    return {
        "clip": body["clipId"],
        "file": out.name,
        "subject": body["subjectPseudonym"],
        "pattern": body["pattern"],
        "exercise": body["exerciseId"],
        "correctness": body.get("correctness"),
        "keypoint_quality": annotation.get("keypointQuality"),
        "rep_boundaries": annotation.get("repBoundaries", []),
        "phases": annotation.get("phases", []),
        "form_deviations": annotation.get("formDeviations", []),
        "camera_placement": body["cameraPlacement"],
        "orientation": body["orientation"],
        "duration_seconds": body["durationSeconds"],
        "frames": int(len(frames)),
        "detection_rate": round(float(detected.mean()), 4),
        "consent_version": body["consentVersion"],
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--input", type=Path, required=True)
    ap.add_argument("--out", type=Path, default=ML / "data" / "keypoints_contributions")
    args = ap.parse_args()

    manifest, records = load_export(args.input)
    args.out.mkdir(parents=True, exist_ok=True)
    clips = [to_npz(body, args.out) for body in records]

    subjects = collections.Counter(c["subject"] for c in clips)
    by_pattern = collections.Counter(c["pattern"] for c in clips)
    subjects_by_pattern: dict[str, set[str]] = collections.defaultdict(set)
    for clip in clips:
        subjects_by_pattern[clip["pattern"]].add(clip["subject"])

    summary = {
        "export_version": manifest.get("version"),
        "export_licence": manifest.get("licence"),
        "clips": len(clips),
        "subjects": len(subjects),
        "by_pattern": dict(by_pattern),
        "subjects_by_pattern": {k: len(v) for k, v in subjects_by_pattern.items()},
        "insufficient_for_split": sorted(
            pattern for pattern, count in subjects_by_pattern.items() if len(count) < 4
        ),
        "files": clips,
    }
    # Manifest lives next to the dataset root, so tests and custom --out paths
    # never write into the repository's ml/data/manifests.
    out_manifest = args.out.parent / "manifests" / f"contributions_{manifest.get('version', 'unknown')}.json"
    out_manifest.parent.mkdir(parents=True, exist_ok=True)
    out_manifest.write_text(json.dumps(summary, indent=2))

    print(f"clips={len(clips)} subjects={len(subjects)}")
    for pattern, count in sorted(by_pattern.items()):
        print(f"  {pattern:17} clips={count:3d} subjects={len(subjects_by_pattern[pattern])}")
    if summary["insufficient_for_split"]:
        print(f"WARNING: fewer than 4 subjects for {summary['insufficient_for_split']}")
    print(f"wrote {out_manifest} and {len(clips)} npz files in {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
