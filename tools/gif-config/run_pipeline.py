#!/usr/bin/env python3
"""
GIF Config Pipeline - Main Orchestrator

Runs the complete offline analysis pipeline:
1. Download GIFs from ExerciseDB catalog
2. Extract MediaPipe landmarks per frame
3. Compute joint angle series
4. Detect cycles and determine primary joints
5. Assign eligibility status
6. Generate outputs (JSON configs, coverage report, review sheets)

Usage:
    python run_pipeline.py [--step STEP] [--exercise-id ID]

Steps: download, landmarks, angles, cycles, outputs, all (default)
"""

import argparse
import sys
import subprocess
from pathlib import Path

# Add parent to path for config import
sys.path.insert(0, str(Path(__file__).parent))

from config import LOGGER


def run_step(step: str, exercise_id: str = None):
    """Run a single pipeline step."""
    script_map = {
        "download": "download_gifs.py",
        "landmarks": "extract_landmarks.py",
        "angles": "compute_angles.py",
        "cycles": "detect_cycles.py",
        "outputs": "generate_outputs.py",
    }

    if step not in script_map:
        LOGGER.error(f"Unknown step: {step}. Available: {list(script_map.keys())}")
        return False

    script = Path(__file__).parent / script_map[step]
    if not script.exists():
        LOGGER.error(f"Script not found: {script}")
        return False

    cmd = [sys.executable, str(script)]
    if exercise_id:
        # For steps that support single exercise (landmarks, angles, cycles)
        # We'd need to modify those scripts to accept --exercise-id
        LOGGER.warning("Single exercise mode not yet implemented for all steps")

    LOGGER.info(f"Running step: {step}")
    result = subprocess.run(cmd, cwd=Path(__file__).parent)

    if result.returncode != 0:
        LOGGER.error(f"Step {step} failed with exit code {result.returncode}")
        return False

    LOGGER.info(f"Step {step} completed successfully")
    return True


def run_all(exercise_id: str = None):
    """Run all pipeline steps in order."""
    steps = ["download", "landmarks", "angles", "cycles", "outputs"]

    for step in steps:
        if not run_step(step, exercise_id):
            LOGGER.error(f"Pipeline stopped at step: {step}")
            return False

    LOGGER.info("Full pipeline completed successfully!")
    return True


def main():
    parser = argparse.ArgumentParser(description="GIF Config Pipeline")
    parser.add_argument(
        "--step",
        choices=["download", "landmarks", "angles", "cycles", "outputs", "all"],
        default="all",
        help="Pipeline step to run (default: all)",
    )
    parser.add_argument(
        "--exercise-id",
        type=str,
        help="Process only a specific exercise ID",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without executing",
    )

    args = parser.parse_args()

    if args.dry_run:
        LOGGER.info(f"DRY RUN: Would run step '{args.step}'")
        if args.exercise_id:
            LOGGER.info(f"  Exercise ID: {args.exercise_id}")
        return

    if args.step == "all":
        success = run_all(args.exercise_id)
    else:
        success = run_step(args.step, args.exercise_id)

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()