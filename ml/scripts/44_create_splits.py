#!/usr/bin/env python3
"""Task 4: Dataset assembly and splits - combine GIF + real video, create splits at GROUP level."""
import json
import yaml
import numpy as np
from pathlib import Path
from collections import Counter
import pandas as pd

# Load taxonomy
with open("configs/taxonomy_v1.yaml") as f:
    taxonomy = yaml.safe_load(f)

# Build pattern -> class mapping
pattern_to_class = {}
for cls in taxonomy["classes"]:
    for pattern in cls["includes"]:
        pattern_to_class[pattern] = cls["name"]

print("Pattern -> Class mapping:")
for p, c in pattern_to_class.items():
    print(f"  {p} -> {c}")

# Load GIF manifest
with open("data/manifests/combined_manifest.json") as f:
    gif_manifest = json.load(f)

# Load exercise_ml_map for pattern lookup
with open("data/exercise_ml_map.json") as f:
    ml_map = json.load(f)

# Build GIF GROUPS (one per exerciseId)
gif_groups = []
for entry in gif_manifest:
    ex_id = entry["exercise_id"]
    pattern = entry["pattern"]
    if pattern not in pattern_to_class:
        continue
    cls = pattern_to_class[pattern]
    gif_groups.append({
        "group_id": ex_id,
        "source_type": "gif",
        "dataset": "exercisedb_gif",
        "pattern": pattern,
        "class": cls,
        "num_frames": entry.get("frames_with_pose", 0),
        "total_frames": entry.get("total_frames", 0),
        "has_windows": entry.get("num_clips", 0) > 0,
    })

print(f"\nGIF groups (exercises): {len(gif_groups)}")

# Load real video manifest (PushUpBench) - check if exists
real_groups = []
pushupbench_manifest = Path("data/manifests/pushupbench_manifest.json")
if pushupbench_manifest.exists():
    with open(pushupbench_manifest) as f:
        pb_manifest = json.load(f)
    
    pb_pattern_map = {
        "c-curl twist": "core_flexion",
        "knee to chest": "core_flexion",
        "bent scissor": "core_flexion",
        "toe taps": "core_flexion",
        "leg extension + crunch [l]": "core_flexion",
        "side crunch + leg stretch [l]": "core_flexion",
        "leg extension + crunch [r]": "core_flexion",
        "side crunch + leg stretch [r]": "core_flexion",
        "reverse lunges challenge": "squat",
        "leg lift": "core_flexion",
        "donkey kick + cross": "hinge",
        "donkey twist": "core_flexion",
        "rainbow": "core_flexion",
        "crossed side kick": "hinge",
        "hamstring curl": "hinge",
        "side leg lift": "lateral_raise",
        "leg swipe": "hinge",
        "leg extension": "hinge",
        "leg circle": "hinge",
        "pointe to heel bridge": "hinge",
        "pointed glute bridge": "hinge",
        "1-leg glute bridge": "hinge",
        "straight leg lift [r]": "core_flexion",
    }
    
    for entry in pb_manifest:
        if "error" in entry:
            continue
        source = entry.get("source", "")
        parts = source.replace(".mp4", "").split("_", 2)
        if len(parts) >= 3:
            ex_name = parts[2].rsplit("_", 1)[0]
        else:
            ex_name = "unknown"
        
        pattern = pb_pattern_map.get(ex_name, "core_flexion")
        if pattern not in pattern_to_class:
            pattern = "core_flexion"
        cls = pattern_to_class[pattern]
        
        real_groups.append({
            "group_id": source.replace(".mp4", ""),
            "source_type": "real_video",
            "dataset": "pushupbench",
            "pattern": pattern,
            "class": cls,
            "num_frames": entry.get("num_frames_resampled", 0),
            "total_frames": entry.get("num_frames_extracted", 0),
            "has_windows": entry.get("num_clips", 0) > 0,
        })

print(f"Real video groups: {len(real_groups)}")

# Combine all groups
all_groups = gif_groups + real_groups
print(f"Total groups: {len(all_groups)}")

# Class distribution at group level
class_counts = Counter(g["class"] for g in all_groups)
print("\nClass distribution (groups):")
for cls, count in class_counts.most_common():
    print(f"  {cls}: {count}")

# Split by group (80/10/10)
np.random.seed(42)
group_ids = [g["group_id"] for g in all_groups]
np.random.shuffle(group_ids)

n_total = len(group_ids)
n_train = int(0.8 * n_total)
n_val = int(0.1 * n_total)

train_ids = set(group_ids[:n_train])
val_ids = set(group_ids[n_train:n_train + n_val])
test_ids = set(group_ids[n_train + n_val:])

print(f"\nGroups: train={len(train_ids)}, val={len(val_ids)}, test={len(test_ids)}")

# Assign splits
for g in all_groups:
    if g["group_id"] in train_ids:
        g["split"] = "train"
    elif g["group_id"] in val_ids:
        g["split"] = "val"
    else:
        g["split"] = "test"

# Verify class balance in splits
for split in ["train", "val", "test"]:
    split_groups = [g for g in all_groups if g["split"] == split]
    split_counts = Counter(g["class"] for g in split_groups)
    print(f"\n{split.upper()} split ({len(split_groups)} groups):")
    for cls, count in split_counts.most_common():
        print(f"  {cls}: {count}")

# Create splits_v1.csv
splits_df = pd.DataFrame(all_groups)
splits_df.to_csv("data/manifests/splits_v1.csv", index=False)
print(f"\nSaved splits to data/manifests/splits_v1.csv ({len(splits_df)} rows)")

# Create data_inventory.md
with open("reports/data_inventory.md", "w") as f:
    f.write("# Data Inventory - Taxonomy v1\n\n")
    f.write(f"Generated: 2026-11-09\n\n")
    
    f.write("## Class Definitions (from taxonomy_v1.yaml)\n\n")
    for cls in taxonomy["classes"]:
        f.write(f"### {cls['name']}\n")
        f.write(f"- **Includes**: {', '.join(cls['includes'])}\n")
        f.write(f"- **Description**: {cls['description']}\n")
        f.write(f"- **Min windows**: {cls['min_windows']}\n\n")
    
    f.write("## Overall Distribution (Groups)\n\n")
    f.write("| Class | Total Groups | Train | Val | Test |\n")
    f.write("|-------|--------------|-------|-----|------|\n")
    
    for cls in class_counts:
        train_c = sum(1 for g in all_groups if g["class"] == cls and g["split"] == "train")
        val_c = sum(1 for g in all_groups if g["class"] == cls and g["split"] == "val")
        test_c = sum(1 for g in all_groups if g["class"] == cls and g["split"] == "test")
        f.write(f"| {cls} | {class_counts[cls]} | {train_c} | {val_c} | {test_c} |\n")
    
    f.write("\n## Source Breakdown\n\n")
    f.write("| Source | Type | Groups | Has Windows |\n")
    f.write("|--------|------|--------|-------------|\n")
    
    for dataset in ["exercisedb_gif", "pushupbench"]:
        ds_groups = [g for g in all_groups if g["dataset"] == dataset]
        has_win = sum(1 for g in ds_groups if g.get("has_windows", False))
        f.write(f"| {dataset} | {'gif' if 'gif' in dataset else 'real_video'} | {len(ds_groups)} | {has_win} |\n")
    
    f.write("\n## Weak Classes (flagged - < 10 groups)\n\n")
    for cls, count in class_counts.most_common():
        if count < 10:
            f.write(f"- **{cls}**: {count} groups (below 10 threshold)\n")
    
    f.write("\n## Split Strategy\n\n")
    f.write("- **Split by group**: Each ExerciseDB exerciseId (GIF) or video file (real) is a group\n")
    f.write("- **No leakage**: All windows from one group go to same split\n")
    f.write("- **Ratios**: 80% train, 10% val, 10% test\n")
    f.write("- **Seed**: 42 (reproducible)\n")
    f.write("- **Hold-out**: Developer's own recordings (B1 blocker) reserved for final test, never used here\n")
    
    f.write("\n## Notes\n\n")
    f.write("- **GIF-only domain gap**: ExerciseDB GIFs are short (~12 frames, 0.8s) - cannot produce 48-frame (3.2s) windows directly.\n")
    f.write("- **Real video**: PushUpBench extraction in progress (231 videos, CC-BY-4.0 license).\n")
    f.write("- **Training approach**: Will use frame-level keypoints + temporal augmentation to create 48-frame windows during training.\n")
    f.write("- **Labels**: All metrics here are 'validated on GIF/public data only; not real-world'.\n")

print("Saved data_inventory.md")