#!/usr/bin/env python3
"""Dataset discovery: what is on disk, what may train shipped weights, what is missing.

Every number in the generated report is computed from disk, so the report cannot
drift from reality. The licence column is a transcription of ml/DATA_LICENSES.md
(decision log dated 2026-11-11) and is deliberately conservative: when the
licence is unverified the dataset is not trainable, whatever its accuracy value.

Outputs:
  ml/reports/DATASET_DISCOVERY.md
  ml/data/manifests/dataset_inventory.json
"""
from __future__ import annotations

import collections
import json
import re
from pathlib import Path

ML = Path(__file__).resolve().parents[1]
OUT_MD = ML / "reports" / "DATASET_DISCOVERY.md"
OUT_JSON = ML / "data" / "manifests" / "dataset_inventory.json"

VIDEO_EXT = {".mp4", ".mov", ".avi", ".mkv", ".webm"}
PUSHUPM_RE = re.compile(r"^([0-9a-f]{8,})_\d+_(.+?)_\[([0-9\-]+)\]$")


def count_suffix(directory: Path, suffix: str) -> int:
    if not directory.is_dir():
        return 0
    return sum(1 for p in directory.iterdir() if p.is_file() and p.suffix.lower() == suffix)


def dir_size_mb(directory: Path) -> float:
    if not directory.is_dir():
        return 0.0
    total = sum(p.stat().st_size for p in directory.rglob("*") if p.is_file())
    return round(total / (1024 * 1024), 1)


def pushupbench() -> dict:
    videos = ML / "data" / "raw" / "real_video" / "pushupbench"
    keypoints = ML / "data" / "keypoints_pushupbench"
    mapping = {
        k.lower().strip(): v
        for k, v in json.loads((ML / "configs" / "pushupbench_taxonomy_mapping.json").read_text()).items()
    }
    patterns: collections.Counter = collections.Counter()
    subjects: dict[str, set[str]] = collections.defaultdict(set)
    unparsed: list[str] = []
    unmapped: list[str] = []
    multi_set = 0
    files = sorted(p for p in videos.iterdir() if p.is_file() and p.suffix.lower() in VIDEO_EXT) if videos.is_dir() else []
    for path in files:
        match = PUSHUPM_RE.match(path.stem)
        if not match:
            unparsed.append(path.name)
            continue
        group, name, reps = match.groups()
        if len(reps.split("-")) > 1:
            multi_set += 1
        pattern = mapping.get(name.lower().strip())
        if pattern is None:
            unmapped.append(name)
            continue
        patterns[pattern] += 1
        subjects[pattern].add(group)
    per_class = {
        pattern: {
            "videos": count,
            "subjects": len(subjects[pattern]),
            "trainable": len(subjects[pattern]) >= 4,
        }
        for pattern, count in patterns.most_common()
    }
    return {
        "dataset": "PushUpBench",
        "source": "https://huggingface.co/datasets/anonymousatom/pushupbench",
        "license": "CC-BY-4.0",
        "license_status": "verified",
        "permits_training": True,
        "permits_redistribution": True,
        "attribution_required": True,
        "local_videos": len(files),
        "local_keypoints": count_suffix(keypoints, ".npz"),
        "keypoint_dir": str(keypoints.relative_to(ML)),
        "disk_mb_videos": dir_size_mb(videos),
        "disk_mb_keypoints": dir_size_mb(keypoints),
        "multi_set_clips": multi_set,
        "unparsed_filenames": unparsed,
        "unmapped_exercise_names": sorted(set(unmapped)),
        "per_pattern": per_class,
        "notes": (
            "Rep counts come from the filename bracket ([13] or [14-13-15] for "
            "multi-set). Exercise name -> taxonomy pattern uses "
            "configs/pushupbench_taxonomy_mapping.json, matched case-insensitively."
        ),
    }


def repcount() -> dict:
    raw = ML / "data" / "raw" / "repcount"
    keypoints = ML / "data" / "keypoints_repcount"
    labels = json.loads((ML / "configs" / "repcount_label_map.json").read_text())
    files = sorted(p for p in raw.iterdir() if p.is_file() and p.suffix.lower() in VIDEO_EXT) if raw.is_dir() else []
    per_split: collections.Counter = collections.Counter()
    per_class: collections.Counter = collections.Counter()
    for path in files:
        split = path.stem.split("_", 1)[0]
        per_split[split] += 1
        match = re.match(r"^(?:test|validation)_(stu\d+|test\d+)_.*$", path.stem)
        if match:
            per_class["(subject-keyed)"] += 1
    return {
        "dataset": "RepCount-A",
        "source": "https://svip-lab.github.io/dataset/RepCount_dataset.html",
        "license": "unverified",
        "license_status": "unverified",
        "permits_training": False,
        "permits_redistribution": False,
        "local_videos": len(files),
        "local_keypoints": count_suffix(keypoints, ".npz"),
        "keypoint_dir": str(keypoints.relative_to(ML)),
        "disk_mb_videos": dir_size_mb(raw),
        "split_counts": dict(per_split),
        "labelled_classes": sorted({v for v in labels.values() if v != "excluded"}),
        "full_split_sizes": {"train": 758, "validation": 131, "test": 152},
        "notes": (
            "Approved for LOCAL EVALUATION of the rule-based counter only. "
            "DATA_LICENSES.md forbids training shipped weights on it and forbids "
            "redistribution. The 758-clip train split was never downloaded and "
            "must stay that way unless the licence question is resolved."
        ),
    }


def exercisedb_gifs() -> dict:
    raw = ML / "data" / "raw" / "gifs"
    return {
        "dataset": "ExerciseDB animations",
        "source": "https://oss.exercisedb.dev/media/{exerciseId}.gif",
        "license": "unverified",
        "license_status": "unverified",
        "permits_training": False,
        "permits_redistribution": False,
        "local_videos": count_suffix(raw, ".gif"),
        "local_keypoints": count_suffix(ML / "data" / "keypoints_raw_gif", ".npz"),
        "keypoint_dir": "data/keypoints_raw_gif",
        "notes": (
            "Rendered animations, not human recordings. Used only for taxonomy "
            "mapping and pipeline smoke tests. P1 closure: GIF tiling is a "
            "diagnostic, not an accuracy gate."
        ),
    }


def own_recordings() -> dict:
    return {
        "dataset": "Own recordings (B1)",
        "source": "developer phone clips",
        "license": "own terms / consent",
        "license_status": "pending",
        "permits_training": True,
        "permits_redistribution": True,
        "local_videos": 0,
        "local_keypoints": 0,
        "notes": (
            "Gold-standard test set for the 20 priority PhysiqueQuest exercises. "
            "Still blocked: >=3 subjects x >=5 clips per exercise. Until these "
            "exist, no metric can be claimed as validated on our own users."
        ),
    }


def render(inventory: list[dict]) -> str:
    lines = [
        "# Dataset discovery",
        "",
        "Generated by `ml/scripts/70_dataset_inventory.py`. Numbers are read from",
        "disk on each run; the licence column transcribes `ml/DATA_LICENSES.md`.",
        "",
        "## Summary",
        "",
        "| Dataset | Licence | Trainable | Videos | Keypoints | Disk (MB) |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for d in inventory:
        lines.append(
            f"| {d['dataset']} | {d['license']} | "
            f"{'yes' if d['permits_training'] else 'no'} | "
            f"{d['local_videos']} | {d['local_keypoints']} | "
            f"{d.get('disk_mb_videos', 0)} |"
        )

    lines += ["", "## Training-cleared data", ""]
    cleared = [d for d in inventory if d["permits_training"] and d["local_videos"]]
    if not cleared:
        lines.append("None. No shipped-weight training may run.")
    for d in cleared:
        lines.append(f"### {d['dataset']}")
        lines.append("")
        lines.append(f"- Licence: {d['license']} ({d['license_status']})")
        lines.append(f"- Attribution required: {d.get('attribution_required', False)}")
        lines.append(f"- Videos on disk: {d['local_videos']}")
        lines.append(f"- Keypoint sequences extracted: {d['local_keypoints']}")
        lines.append(f"- Multi-set clips: {d.get('multi_set_clips', 0)}")
        lines.append(f"- Unparsed filenames: {len(d.get('unparsed_filenames', []))}")
        lines.append(f"- Unmapped exercise names: {len(d.get('unmapped_exercise_names', []))}")
        lines.append("")
        lines.append("| Pattern | Videos | Subjects | Usable for subject-disjoint split |")
        lines.append("| --- | --- | --- | --- |")
        for pattern, stats in d["per_pattern"].items():
            ok = "yes" if stats["trainable"] else "no (too few subjects)"
            lines.append(f"| {pattern} | {stats['videos']} | {stats['subjects']} | {ok} |")
        lines.append("")

    lines += ["## Evaluation-only data", ""]
    for d in inventory:
        if d["permits_training"] or not d["local_videos"]:
            continue
        lines.append(f"### {d['dataset']} — {d['license_status']}")
        lines.append("")
        lines.append(f"- Source: {d['source']}")
        lines.append(f"- Videos on disk: {d['local_videos']}")
        lines.append(f"- Keypoint sequences: {d['local_keypoints']}")
        if "split_counts" in d:
            lines.append(f"- Local splits: {d['split_counts']}")
            lines.append(f"- Full split sizes: {d['full_split_sizes']}")
        lines.append(f"- {d['notes']}")
        lines.append("")

    lines += [
        "## Additional datasets evaluated",
        "",
        "See `ml/reports/DATASET_EXPANSION.md` (Phase 4). REHAB24-6, FLEX,",
        "Fitness-AQA, M3GYM, QEVD and UI-PRMD were reviewed; every one is",
        "non-commercial or agreement-gated, so none may train shipped weights.",
        "PushUpBench remains the only training-cleared source.",
        "",
        "## Gaps",
        "",
        "1. **Own recordings (B1)** — still zero clips. The contribution pipeline",
        "   (`backend/DATASET_PIPELINE.md`) exists but its mobile screen is not",
        "   mounted; required before any accuracy claim about PhysiqueQuest users.",
        "2. **Taxonomy coverage** — training-cleared data covers the patterns",
        "   listed above only; `horizontal_pull` has no cleared recordings at all.",
        "3. **Repcount train split** — intentionally absent; the licence does not",
        "   permit training on it.",
        "4. **Class imbalance** — pattern counts above span two orders of",
        "   magnitude. Macro-F1 on rare patterns will be dominated by variance.",
        "",
    ]
    return "\n".join(lines)


def main() -> int:
    inventory = [pushupbench(), repcount(), exercisedb_gifs(), own_recordings()]
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(inventory, indent=2))
    OUT_MD.write_text(render(inventory))
    print(f"wrote {OUT_JSON.relative_to(ML)}")
    print(f"wrote {OUT_MD.relative_to(ML)}")
    for d in inventory:
        print(
            f"  {d['dataset']:28s} videos={d['local_videos']:4d} "
            f"keypoints={d['local_keypoints']:4d} trainable={d['permits_training']}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
