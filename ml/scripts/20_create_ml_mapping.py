#!/usr/bin/env python3
"""Create ML mapping for ExerciseDB exercises - Phase 2"""
import json
import re
from pathlib import Path
from collections import Counter

# Load catalog
catalog_path = Path(__file__).parent.parent / "data" / "exercisedb_catalog.json"
with open(catalog_path) as f:
    catalog = json.load(f)

print(f"Loaded {len(catalog)} exercises")

# Movement pattern taxonomy
MOVEMENT_PATTERNS = [
    "squat", "hinge", "lunge", "horizontal_push", "vertical_push",
    "horizontal_pull", "vertical_pull", "curl", "triceps_extension",
    "lateral_raise", "front_raise", "rear_delt", "calf_raise",
    "hip_thrust_bridge", "core_flexion", "core_isometric",
    "rotation", "leg_extension_curl_machine", "carry_locomotion",
    "cardio_dynamic", "other_unknown"
]

# Rep signal definitions: (primary_joint_triplet, side_mode, is_isometric)
REP_SIGNALS = {
    "squat": (["hip", "knee", "ankle"], "bilateral", False),
    "hinge": (["shoulder", "hip", "knee"], "bilateral", False),
    "lunge": (["hip", "knee", "ankle"], "unilateral", False),
    "horizontal_push": (["shoulder", "elbow", "wrist"], "bilateral", False),
    "vertical_push": (["shoulder", "elbow", "wrist"], "bilateral", False),
    "horizontal_pull": (["shoulder", "elbow", "wrist"], "bilateral", False),
    "vertical_pull": (["shoulder", "elbow", "wrist"], "bilateral", False),
    "curl": (["shoulder", "elbow", "wrist"], "unilateral", False),
    "triceps_extension": (["shoulder", "elbow", "wrist"], "unilateral", False),
    "lateral_raise": (["hip", "shoulder", "elbow"], "unilateral", False),
    "front_raise": (["hip", "shoulder", "elbow"], "unilateral", False),
    "rear_delt": (["shoulder", "elbow", "wrist"], "unilateral", False),
    "calf_raise": (["knee", "ankle", "foot"], "bilateral", False),
    "hip_thrust_bridge": (["shoulder", "hip", "knee"], "bilateral", False),
    "core_flexion": (["shoulder", "hip", "knee"], "bilateral", False),
    "core_isometric": (["shoulder", "hip", "knee"], "bilateral", True),
    "rotation": (["shoulder", "hip", "spine"], "unilateral", False),
    "leg_extension_curl_machine": (["hip", "knee", "ankle"], "bilateral", False),
    "carry_locomotion": (["hip", "knee", "ankle"], "alternating", False),
    "cardio_dynamic": (["hip", "knee", "ankle"], "alternating", False),
    "other_unknown": (["shoulder", "hip", "knee"], "unknown", False),
}

# Camera orientation recommendations
CAMERA_ORIENTATION = {
    "squat": "side", "hinge": "side", "lunge": "side",
    "horizontal_push": "front", "vertical_push": "front",
    "horizontal_pull": "front", "vertical_pull": "front",
    "curl": "front", "triceps_extension": "front",
    "lateral_raise": "front", "front_raise": "front",
    "rear_delt": "front", "calf_raise": "side",
    "hip_thrust_bridge": "side", "core_flexion": "side",
    "core_isometric": "side", "rotation": "front",
    "leg_extension_curl_machine": "side",
    "carry_locomotion": "side", "cardio_dynamic": "front",
    "other_unknown": "side",
}

# Deterministic keyword rules for pattern assignment
PATTERN_RULES = [
    # Squat variations
    (["squat", "goblet squat", "back squat", "front squat", "overhead squat", "pistol squat", "bulgarian split squat", "split squat", "jump squat"], "squat"),
    # Hinge variations
    (["deadlift", "romanian deadlift", "rdl", "stiff leg deadlift", "single leg deadlift", "good morning", "hip hinge", "kettlebell swing"], "hinge"),
    # Lunge variations
    (["lunge", "walking lunge", "reverse lunge", "side lunge", "lateral lunge", "curtsy lunge"], "lunge"),
    # Horizontal push
    (["bench press", "push up", "push-up", "chest press", "floor press", "incline press", "decline press", "dumbbell press", "machine press", "cable press", "fly", "flye", "pec deck"], "horizontal_push"),
    # Vertical push
    (["shoulder press", "overhead press", "military press", "arnold press", "push press", "handstand push", "pike push", "dumbbell shoulder press", "machine shoulder press"], "vertical_push"),
    # Horizontal pull
    (["row", "bent over row", "seated row", "cable row", "dumbbell row", "barbell row", "t-bar row", "inverted row", "chest supported row", "meadows row"], "horizontal_pull"),
    # Vertical pull
    (["pull up", "pull-up", "chin up", "chin-up", "lat pulldown", "lat pull down", "assisted pull up", "neutral grip pull"], "vertical_pull"),
    # Curl variations
    (["curl", "bicep curl", "hammer curl", "preacher curl", "concentration curl", "incline curl", "cable curl", "dumbbell curl", "barbell curl", "ez bar curl"], "curl"),
    # Triceps
    (["tricep", "triceps", "pushdown", "extension", "skullcrusher", "overhead extension", "kickback", "dip", "close grip press"], "triceps_extension"),
    # Lateral raise
    (["lateral raise", "side raise", "side lateral", "dumbbell lateral"], "lateral_raise"),
    # Front raise
    (["front raise", "front dumbbell raise"], "front_raise"),
    # Rear delt
    (["rear delt", "reverse fly", "face pull", "band pull apart"], "rear_delt"),
    # Calf
    (["calf raise", "heel raise", "standing calf", "seated calf", "donkey calf"], "calf_raise"),
    # Hip thrust / glute bridge
    (["hip thrust", "glute bridge", "kas glute bridge", "single leg glute bridge"], "hip_thrust_bridge"),
    # Core flexion
    (["crunch", "sit up", "sit-up", "leg raise", "knee raise", "reverse crunch", "bicycle crunch", "russian twist", "v-up", "toe touch"], "core_flexion"),
    # Core isometric
    (["plank", "side plank", "hollow hold", "dead bug", "bird dog", "paloff press", "pallof press", "ab wheel", "stir the pot"], "core_isometric"),
    # Rotation
    (["rotation", "woodchop", "windmill", "turkish get up", "landmine"], "rotation"),
    # Leg extension/curl machine
    (["leg extension", "leg curl", "seated leg curl", "lying leg curl", "standing leg curl"], "leg_extension_curl_machine"),
    # Carry
    (["carry", "farmer walk", "suitcase carry", "waiter walk", "overhead carry"], "carry_locomotion"),
    # Cardio dynamic
    (["burpee", "mountain climber", "jumping jack", "high knees", "butt kicker", "skater", "lateral shuffle", "bear crawl", "sprint", "jump rope"], "cardio_dynamic"),
]

# Equipment-based overrides (when name is ambiguous)
EQUIPMENT_PATTERN_HINTS = {
    "machine": "horizontal_push",  # default for machine exercises
    "cable": "horizontal_pull",    # cables often pulling
    "barbell": "squat",            # barbell often compound
    "dumbbell": "curl",            # dumbbell often accessory
    "kettlebell": "hinge",         # kettlebell often swing/hinge
    "bodyweight": "squat",         # bodyweight often squat/push
    "resistance band": "horizontal_pull",  # bands often pull
    "smith machine": "squat",
    "leverage machine": "horizontal_push",
    "sled machine": "carry_locomotion",
    "elliptical machine": "cardio_dynamic",
    "stepmill machine": "cardio_dynamic",
    "stationary bike": "cardio_dynamic",
}

# Body part hints
BODY_PART_HINTS = {
    "chest": "horizontal_push",
    "back": "horizontal_pull",
    "shoulders": "vertical_push",
    "upper legs": "squat",
    "lower legs": "calf_raise",
    "waist": "core_isometric",
    "upper arms": "curl",
    "lower arms": "curl",
    "cardio": "cardio_dynamic",
}

def assign_pattern(exercise):
    """Assign movement pattern using deterministic rules"""
    name = exercise["name"].lower()
    equipments = [e.lower() for e in exercise.get("equipments", [])]
    body_parts = [b.lower() for b in exercise.get("bodyParts", [])]
    target_muscles = [m.lower() for m in exercise.get("targetMuscles", [])]
    
    # 1. Name-based rules (most specific first)
    for keywords, pattern in PATTERN_RULES:
        for kw in keywords:
            if kw in name:
                return pattern, "rule"
    
    # 2. Equipment hints
    for eq in equipments:
        if eq in EQUIPMENT_PATTERN_HINTS:
            return EQUIPMENT_PATTERN_HINTS[eq], "equipment_hint"
    
    # 3. Body part hints
    for bp in body_parts:
        if bp in BODY_PART_HINTS:
            return BODY_PART_HINTS[bp], "body_part_hint"
    
    # 4. Target muscle hints
    for tm in target_muscles:
        if "quadriceps" in tm or "glute" in tm:
            return "squat", "target_muscle_hint"
        if "hamstring" in tm:
            return "hinge", "target_muscle_hint"
        if "pectoral" in tm or "chest" in tm:
            return "horizontal_push", "target_muscle_hint"
        if "latissimus" in tm or "trapezius" in tm or "rhomboid" in tm:
            return "horizontal_pull", "target_muscle_hint"
        if "deltoid" in tm or "shoulder" in tm:
            return "vertical_push", "target_muscle_hint"
        if "bicep" in tm:
            return "curl", "target_muscle_hint"
        if "tricep" in tm:
            return "triceps_extension", "target_muscle_hint"
        if "calf" in tm or "gastrocnemius" in tm or "soleus" in tm:
            return "calf_raise", "target_muscle_hint"
        if "abdominal" in tm or "core" in tm or "oblique" in tm:
            return "core_isometric", "target_muscle_hint"
    
    return "other_unknown", "unresolved"

# Build the mapping
exercise_ml_map = {}
pattern_counts = Counter()
source_counts = Counter()
needs_review = []

for ex in catalog:
    exercise_id = ex["exerciseId"]
    pattern, source = assign_pattern(ex)
    
    # Determine trackable
    trackable = pattern != "other_unknown"
    trackable_reason = ""
    if not trackable:
        trackable_reason = "No movement pattern matched"
    elif any(eq in [e.lower() for e in ex.get("equipments", [])] for eq in ["machine", "cable", "smith machine", "leverage machine", "sled machine"]):
        trackable_reason = "Machine/cable exercises with potential occlusion"
        trackable = True  # Still trackable but with caveats
    
    # Get rep signal
    joint_triplet, side_mode, is_isometric = REP_SIGNALS.get(pattern, (["shoulder", "hip", "knee"], "unknown", False))
    
    # Camera orientation
    camera_orient = CAMERA_ORIENTATION.get(pattern, "side")
    
    exercise_ml_map[exercise_id] = {
        "exerciseId": exercise_id,
        "name": ex["name"],
        "movement_pattern": pattern,
        "rep_signal": {
            "primary_joints": joint_triplet,
            "side_mode": side_mode,
            "is_isometric": is_isometric
        },
        "camera_orientation": camera_orient,
        "trackable": trackable,
        "trackable_reason": trackable_reason,
        "mapping_source": source,
        "needs_review": source in ["equipment_hint", "body_part_hint", "target_muscle_hint", "unresolved"],
        "equipments": ex.get("equipments", []),
        "bodyParts": ex.get("bodyParts", []),
        "targetMuscles": ex.get("targetMuscles", []),
        "gifUrl": ex.get("gifUrl", ""),
    }
    
    pattern_counts[pattern] += 1
    source_counts[source] += 1
    
    if exercise_ml_map[exercise_id]["needs_review"]:
        needs_review.append({
            "exerciseId": exercise_id,
            "name": ex["name"],
            "pattern": pattern,
            "source": source,
            "equipments": ex.get("equipments", []),
            "bodyParts": ex.get("bodyParts", []),
            "targetMuscles": ex.get("targetMuscles", []),
        })

# Save mapping
output_path = Path(__file__).parent.parent / "data" / "exercise_ml_map.json"
with open(output_path, "w") as f:
    json.dump(exercise_ml_map, f, indent=2)

# Save review list
review_path = Path(__file__).parent.parent / "reports" / "mapping_review.csv"
import csv
with open(review_path, "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=["exerciseId", "name", "pattern", "source", "equipments", "bodyParts", "targetMuscles"])
    writer.writeheader()
    for row in needs_review:
        writer.writerow({
            "exerciseId": row["exerciseId"],
            "name": row["name"],
            "pattern": row["pattern"],
            "source": row["source"],
            "equipments": "; ".join(row["equipments"]),
            "bodyParts": "; ".join(row["bodyParts"]),
            "targetMuscles": "; ".join(row["targetMuscles"]),
        })

# Coverage report
coverage_path = Path(__file__).parent.parent / "reports" / "mapping_coverage.md"
with open(coverage_path, "w") as f:
    f.write("# ExerciseDB ML Mapping Coverage Report\n\n")
    f.write(f"**Total exercises**: {len(catalog)}\n\n")
    f.write("## Pattern Distribution\n\n")
    for pattern, count in pattern_counts.most_common():
        f.write(f"- **{pattern}**: {count}\n")
    f.write("\n## Mapping Source Distribution\n\n")
    for source, count in source_counts.most_common():
        f.write(f"- **{source}**: {count}\n")
    f.write(f"\n## Needs Review: {len(needs_review)} exercises\n\n")
    f.write("## Trackable Status\n\n")
    trackable_count = sum(1 for v in exercise_ml_map.values() if v["trackable"])
    f.write(f"- **Trackable**: {trackable_count}\n")
    f.write(f"- **Not Trackable**: {len(catalog) - trackable_count}\n")

print(f"\nMapping complete!")
print(f"Pattern distribution: {dict(pattern_counts.most_common())}")
print(f"Source distribution: {dict(source_counts.most_common())}")
print(f"Needs review: {len(needs_review)}")
print(f"Saved mapping to {output_path}")
print(f"Saved review list to {review_path}")
print(f"Saved coverage report to {coverage_path}")