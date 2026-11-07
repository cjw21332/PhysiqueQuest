#!/usr/bin/env python3
"""
Import Generated Configs Script

Imports GIF-derived generated-angle configs into the PoseTracker MongoDB collection.
Default mode is --dry-run (prints diff summary). Use --apply to write.

Usage:
    python import_configs.py --dry-run          # Default: preview changes
    python import_configs.py --apply            # Write to database
    python import_configs.py --apply --force    # Overwrite existing (not recommended)
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Dict, Any, List, Tuple
from dataclasses import dataclass

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError

# Add backend to path for config
backend_path = Path(__file__).parent.parent.parent / "backend"
sys.path.insert(0, str(backend_path))

# Load environment
from dotenv import load_dotenv
from pymongo.uri_parser import parse_uri
load_dotenv(backend_path / ".env")

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017/test")
DB_NAME = os.getenv('POSETRACKER_DB_NAME') or parse_uri(MONGODB_URI).get('database') or 'test'
COLLECTION_NAME = "exerciseposetrackerconfigs"

GENERATED_CONFIGS_PATH = Path(__file__).parent / "output" / "generated_configs.json"


@dataclass
class DiffResult:
    exercise_id: str
    action: str  # 'insert', 'update', 'skip', 'conflict'
    details: str
    old_config: Dict[str, Any] = None
    new_config: Dict[str, Any] = None


def load_generated_configs() -> List[Dict[str, Any]]:
    """Load generated configs from JSON file."""
    if not GENERATED_CONFIGS_PATH.exists():
        print(f"ERROR: Generated configs not found at {GENERATED_CONFIGS_PATH}")
        print("Run the pipeline first: python run_pipeline.py")
        sys.exit(1)

    with open(GENERATED_CONFIGS_PATH) as f:
        return json.load(f)


def connect_db():
    """Connect to MongoDB."""
    client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
    client.admin.command('ping')
    return client[DB_NAME]


def build_override_config(gen_config: Dict[str, Any]) -> Dict[str, Any]:
    """Build a ConfigOverride from generated config."""
    return {
        "trackingMode": "generated-angle",
        "cameraOrientation": gen_config.get("viewHint", "unknown"),
        "validationStatus": "verified" if gen_config.get("verified", False) else "pending",
        "limitations": [
            "Generated from ExerciseDB GIF analysis; real-person accuracy not validated.",
            "Camera cannot assess pain, injury risk or equipment load.",
            f"Generator version: {gen_config.get('generatorVersion', 'unknown')}",
            f"Primary joints: {', '.join(gen_config.get('primaryJoints', []))}",
            f"Side mode: {gen_config.get('sideMode', 'unknown')}",
            f"Cycle count in GIF: {gen_config.get('cycleCount', 0)}",
        ] + (gen_config.get("reasonCodes", [])),
        "generatedAngleConfig": {
            "source": "gif-derived",
            "verified": gen_config.get("verified", False),
            "liveValidated": gen_config.get("liveValidated", False),
            "primaryJoints": gen_config.get("primaryJoints", []),
            "sideMode": gen_config.get("sideMode", "unknown"),
            "startAngles": gen_config.get("startAngles", {}),
            "peakAngles": gen_config.get("peakAngles", {}),
            "directions": gen_config.get("directions", {}),
            "referenceRanges": gen_config.get("referenceRanges", {}),
            "stabilityConstraints": gen_config.get("stabilityConstraints", []),
            "viewHint": gen_config.get("viewHint", "unknown"),
            "cycleCount": gen_config.get("cycleCount", 0),
            "validFraction": gen_config.get("validFraction", 0.0),
            "thresholdsUsed": gen_config.get("thresholdsUsed", {}),
            "generatorVersion": gen_config.get("generatorVersion", "1.0.0"),
            "generatedAt": gen_config.get("generatedAt", ""),
        },
        "updatedAt": gen_config.get("generatedAt", ""),
        "verifiedAt": gen_config.get("generatedAt", "") if gen_config.get("verified", False) else None,
    }


def compute_diff(db, gen_configs: List[Dict[str, Any]], force: bool = False) -> List[DiffResult]:
    """Compute diff between generated configs and database."""
    collection = db[COLLECTION_NAME]
    results = []

    # Get existing configs
    existing = {doc["exerciseId"]: doc["config"] for doc in collection.find({}, {"exerciseId": 1, "config": 1})}

    for gen in gen_configs:
        exercise_id = gen.get("exerciseId")
        if not exercise_id:
            continue

        new_override = build_override_config(gen)
        existing_config = existing.get(exercise_id)

        if existing_config is None:
            # No existing config - insert
            results.append(DiffResult(
                exercise_id=exercise_id,
                action="insert",
                details=f"New generated-angle config (status: {gen.get('status')}, verified: {gen.get('verified')})",
                new_config=new_override,
            ))
        else:
            existing_mode = existing_config.get("trackingMode")
            existing_verified = existing_config.get("validationStatus") == "verified"

            # Check if existing is admin-verified (builtin or reference with verified status)
            is_admin_verified = existing_mode in ("builtin", "reference") and existing_verified

            if is_admin_verified and not force:
                results.append(DiffResult(
                    exercise_id=exercise_id,
                    action="skip",
                    details=f"Admin-verified {existing_mode} config exists (validationStatus=verified). Use --force to override.",
                    old_config=existing_config,
                    new_config=new_override,
                ))
            elif existing_mode == "generated-angle":
                # Existing is also generated-angle - update if different
                existing_gen = existing_config.get("generatedAngleConfig", {})
                existing_ver = existing_gen.get("generatorVersion", "0.0.0")
                new_ver = gen.get("generatorVersion", "0.0.0")
                if existing_ver != new_ver or force:
                    results.append(DiffResult(
                        exercise_id=exercise_id,
                        action="update",
                        details=f"Update generated-angle config (v{existing_ver} -> v{new_ver})",
                        old_config=existing_config,
                        new_config=new_override,
                    ))
                else:
                    results.append(DiffResult(
                        exercise_id=exercise_id,
                        action="skip",
                        details=f"Same generator version ({existing_ver}) already stored",
                        old_config=existing_config,
                    ))
            else:
                # Existing is unavailable/pending - replace with generated
                results.append(DiffResult(
                    exercise_id=exercise_id,
                    action="update",
                    details=f"Replace {existing_mode} with generated-angle (status: {gen.get('status')})",
                    old_config=existing_config,
                    new_config=new_override,
                ))

    return results


def print_diff_summary(diffs: List[DiffResult]):
    """Print human-readable diff summary."""
    action_counts = {}
    for d in diffs:
        action_counts[d.action] = action_counts.get(d.action, 0) + 1

    print("\n" + "=" * 60)
    print("IMPORT DIFF SUMMARY")
    print("=" * 60)
    print(f"Total exercises in generated configs: {len(diffs)}")
    for action, count in sorted(action_counts.items()):
        print(f"  {action.capitalize()}: {count}")

    print("\nDETAILS:")
    for d in diffs:
        if d.action in ("insert", "update"):
            print(f"  [{d.action.upper()}] {d.exercise_id}: {d.details}")
            if d.new_config and d.new_config.get("generatedAngleConfig"):
                gc = d.new_config["generatedAngleConfig"]
                print(f"    Primary joints: {gc.get('primaryJoints')}")
                print(f"    Side mode: {gc.get('sideMode')}")
                print(f"    Status: {'verified' if gc.get('verified') else 'pending'}")
        elif d.action == "skip" and "Admin-verified" in d.details:
            print(f"  [SKIP] {d.exercise_id}: {d.details}")

    print("=" * 60)


def apply_diffs(db, diffs: List[DiffResult], user_id: str = "gif-pipeline-import"):
    """Apply diffs to database."""
    collection = db[COLLECTION_NAME]
    applied = 0
    for d in diffs:
        if d.action in ("insert", "update") and d.new_config:
            try:
                config_to_save = d.new_config.copy()
                config_to_save["updatedBy"] = user_id
                if config_to_save.get("verifiedAt") is None:
                    config_to_save.pop("verifiedAt", None)
                collection.update_one(
                    {"exerciseId": d.exercise_id},
                    {"$set": {"config": config_to_save, "updatedBy": user_id}},
                    upsert=True
                )
                applied += 1
            except Exception as e:
                print(f"ERROR applying {d.exercise_id}: {e}")
    print(f"\nApplied {applied} changes to database.")


def main():
    parser = argparse.ArgumentParser(description="Import GIF-derived generated-angle configs")
    parser.add_argument("--apply", action="store_true", help="Apply changes (default: dry-run)")
    parser.add_argument("--force", action="store_true", help="Override admin-verified configs (use with caution)")
    parser.add_argument("--user-id", default="gif-pipeline-import", help="User ID for audit trail")
    args = parser.parse_args()

    # Fail closed until catalog-based built-in precedence and atomic protected
    # updates are implemented and tested. A stale dry run cannot protect writes.
    if args.apply:
        print('ERROR: Import writes are disabled until protected mapping precedence is implemented and tested.')
        sys.exit(1)

    if not args.apply:
        print("DRY RUN MODE - no changes will be written")
        print("Use --apply to write changes to database")
    elif args.force:
        print("FORCE MODE - will override admin-verified configs!")
        print("This is NOT recommended for production use.")

    # Load generated configs
    gen_configs = load_generated_configs()
    print(f"Loaded {len(gen_configs)} generated configs from {GENERATED_CONFIGS_PATH}")

    # Connect to DB
    try:
        db = connect_db()
        print(f"Connected to configured MongoDB database: {DB_NAME}")
    except Exception as e:
        print(f"ERROR: Could not connect to MongoDB: {e}")
        sys.exit(1)

    # Compute diff
    diffs = compute_diff(db, gen_configs, force=args.force)
    print_diff_summary(diffs)

    if args.apply:
        confirm = input("\nProceed with import? [y/N]: ").strip().lower()
        if confirm == 'y':
            apply_diffs(db, diffs, user_id=args.user_id)
        else:
            print("Import cancelled.")
    else:
        print("\nDry run complete. Use --apply to write changes.")


if __name__ == "__main__":
    main()
