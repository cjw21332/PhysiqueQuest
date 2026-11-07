"""
Generate Outputs Module

Creates final JSON configs, coverage report (MD + CSV), and review sheets.
"""

import json
import csv
from pathlib import Path
from typing import List, Dict, Any
from dataclasses import asdict
from datetime import datetime
from collections import Counter

import numpy as np
import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision
from PIL import Image, ImageDraw, ImageFont

from config import (
    LANDMARK_CACHE_DIR,
    OUTPUT_DIR,
    REVIEW_SHEETS_DIR,
    REVIEW_SHEET_SAMPLE_SIZE,
    REVIEW_SHEET_COLS,
    REVIEW_SHEET_ROWS,
    GIF_CACHE_DIR,
    STATUS_VALUES,
    REASON_CODES,
    GENERATOR_VERSION,
    LOGGER,
)
from detect_cycles import ExerciseAnalysis, load_angles, analyze_exercise
from extract_landmarks import load_landmarks, ExerciseLandmarks


def load_all_analyses() -> List[ExerciseAnalysis]:
    """Load all generated analyses from JSON."""
    path = OUTPUT_DIR / "generated_configs.json"
    if not path.exists():
        return []

    with open(path) as f:
        data = json.load(f)

    analyses = []
    for d in data:
        # Reconstruct objects
        # Simplified - just keep as dict for reporting
        analyses.append(d)

    return analyses


def generate_coverage_report(analyses: List[Dict[str, Any]]) -> Tuple[str, str]:
    """Generate coverage report in Markdown and CSV."""
    total = len(analyses)

    # Count by status
    status_counts = Counter(a.get("status", "unknown") for a in analyses)

    # Count by reason code
    reason_counts = Counter()
    for a in analyses:
        for code in a.get("reason_codes", []):
            reason_counts[code] += 1

    # Group by equipment (would need catalog data - placeholder)
    # Group by body part (placeholder)

    # Markdown report
    md_lines = [
        "# GIF-Derived Config Coverage Report",
        f"\nGenerated: {datetime.utcnow().isoformat()}Z",
        f"Generator version: {GENERATOR_VERSION}",
        f"\n## Summary",
        f"- Total exercises analyzed: {total}",
    ]

    for status, count in sorted(status_counts.items()):
        desc = STATUS_VALUES.get(status, status)
        md_lines.append(f"- {status} ({desc}): {count}")

    md_lines.append(f"\n## Reason Codes")
    for code, count in sorted(reason_counts.items()):
        desc = REASON_CODES.get(code, code)
        md_lines.append(f"- {code} ({desc}): {count}")

    md_lines.append(f"\n## Per-Exercise Details")
    md_lines.append("\n| Exercise ID | Name | Status | Reason Codes | Primary Joints | Side Mode | Cycles | Valid Frac | View |")
    md_lines.append("|---|---|---|---|---|---|---|---|---|")

    for a in sorted(analyses, key=lambda x: x.get("exerciseId", "")):
        ex_id = a.get("exerciseId", "")
        name = a.get("name", ex_id)  # Would need catalog for name
        status = a.get("status", "unknown")
        reasons = ", ".join(a.get("reason_codes", [])) or "—"
        joints = ", ".join(a.get("primary_joints", [])) or "—"
        side = a.get("side_mode", "unknown")
        cycles = a.get("cycle_count", 0)
        valid = a.get("valid_fraction", 0.0)
        view = a.get("view_hint", "unknown")

        md_lines.append(f"| {ex_id} | {name} | {status} | {reasons} | {joints} | {side} | {cycles} | {valid:.2f} | {view} |")

    md_report = "\n".join(md_lines)

    # CSV report
    csv_path = OUTPUT_DIR / "coverage_report.csv"
    with open(csv_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "exerciseId", "name", "status", "reason_codes",
            "primary_joints", "side_mode", "cycle_count",
            "valid_fraction", "view_hint", "person_detected_fraction",
            "fps", "frame_count", "duration_ms"
        ])
        for a in sorted(analyses, key=lambda x: x.get("exerciseId", "")):
            writer.writerow([
                a.get("exerciseId", ""),
                a.get("name", ""),
                a.get("status", ""),
                ";".join(a.get("reason_codes", [])),
                ";".join(a.get("primary_joints", [])),
                a.get("side_mode", ""),
                a.get("cycle_count", 0),
                a.get("valid_fraction", 0.0),
                a.get("view_hint", ""),
                a.get("person_detected_fraction", 0.0),
                a.get("fps", 0.0),
                a.get("frame_count", 0),
                a.get("duration_ms", 0.0),
            ])

    return md_report, str(csv_path)


def create_review_sheet_image(
    exercise_id: str,
    gif_path: Path,
    landmarks: ExerciseLandmarks,
    analysis: Dict[str, Any],
) -> Optional[Path]:
    """Create a single review sheet image with skeleton overlay."""
    try:
        # Load GIF frames
        cap = cv2.VideoCapture(str(gif_path))
        frames = []
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            frames.append(frame)
        cap.release()

        if not frames:
            return None

        # Sample frames evenly
        n_samples = min(REVIEW_SHEET_COLS * REVIEW_SHEET_ROWS, len(frames))
        indices = np.linspace(0, len(frames) - 1, n_samples, dtype=int)

        # Create grid image
        cell_w, cell_h = 160, 160
        grid_w = cell_w * REVIEW_SHEET_COLS
        grid_h = cell_h * REVIEW_SHEET_ROWS
        grid_img = Image.new("RGB", (grid_w, grid_h + 40), (240, 240, 240))
        draw = ImageDraw.Draw(grid_img)

        # Title
        try:
            font = ImageFont.truetype("arial.ttf", 12)
        except:
            font = ImageFont.load_default()

        status = analysis.get("status", "unknown")
        primary = ", ".join(analysis.get("primary_joints", [])) or "none"
        draw.text((10, 5), f"{exercise_id} | {status} | primary: {primary}", fill=(0, 0, 0), font=font)

        # MediaPipe drawing utils
        mp_drawing = mp.solutions.drawing_utils
        mp_pose = mp.solutions.pose

        for idx, frame_idx in enumerate(indices):
            row = idx // REVIEW_SHEET_COLS
            col = idx % REVIEW_SHEET_COLS

            if frame_idx >= len(frames) or frame_idx >= len(landmarks.frames):
                continue

            frame = frames[frame_idx].copy()
            lm_data = landmarks.frames[frame_idx]

            # Draw skeleton if person detected
            if lm_data.person_detected and lm_data.landmarks:
                # Convert to format MediaPipe expects
                h, w = frame.shape[:2]
                # Draw connections manually for simplicity
                connections = [
                    (11, 13), (13, 15), (12, 14), (14, 16),  # arms
                    (11, 12), (23, 24), (11, 23), (12, 24),  # torso
                    (23, 25), (25, 27), (24, 26), (26, 28),  # legs
                ]

                for start_idx, end_idx in connections:
                    if start_idx < len(lm_data.landmarks) and end_idx < len(lm_data.landmarks):
                        start = lm_data.landmarks[start_idx]
                        end = lm_data.landmarks[end_idx]
                        if start["visibility"] > 0.5 and end["visibility"] > 0.5:
                            x1, y1 = int(start["x"] * w), int(start["y"] * h)
                            x2, y2 = int(end["x"] * w), int(end["y"] * h)
                            cv2.line(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)

                # Draw landmarks
                for i, lm in enumerate(lm_data.landmarks):
                    if lm["visibility"] > 0.5:
                        x, y = int(lm["x"] * w), int(lm["y"] * h)
                        cv2.circle(frame, (x, y), 3, (255, 0, 0), -1)

            # Resize and convert to PIL
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(frame_rgb)
            pil_img = pil_img.resize((cell_w, cell_h), Image.LANCZOS)

            # Paste into grid
            x = col * cell_w
            y = row * cell_h + 40
            grid_img.paste(pil_img, (x, y))

            # Frame number
            draw.text((x + 2, y + 2), f"#{frame_idx}", fill=(255, 255, 255), font=font)

        # Save
        output_path = REVIEW_SHEETS_DIR / f"{exercise_id}_review.png"
        grid_img.save(output_path)
        return output_path

    except Exception as e:
        LOGGER.error(f"Failed to create review sheet for {exercise_id}: {e}")
        return None


def generate_review_sheets(analyses: List[Dict[str, Any]], sample_size: int = REVIEW_SHEET_SAMPLE_SIZE):
    """Generate review sheet images for a stratified sample."""
    LOGGER.info("Generating review sheets...")

    # Stratify by status
    by_status = {}
    for a in analyses:
        status = a.get("status", "unknown")
        if status not in by_status:
            by_status[status] = []
        by_status[status].append(a)

    # Sample from each status
    sampled = []
    per_status = max(1, sample_size // len(by_status))
    for status, items in by_status.items():
        # Random sample
        np.random.shuffle(items)
        sampled.extend(items[:per_status])

    # Limit to sample_size
    sampled = sampled[:sample_size]

    generated = []
    for analysis in tqdm(sampled, desc="Creating review sheets"):
        ex_id = analysis.get("exerciseId", "")
        gif_path = GIF_CACHE_DIR / f"{ex_id}.gif"
        npz_path = LANDMARK_CACHE_DIR / f"{ex_id}.npz"

        if not gif_path.exists() or not npz_path.exists():
            continue

        landmarks = load_landmarks(ex_id)
        if landmarks is None:
            continue

        img_path = create_review_sheet_image(ex_id, gif_path, landmarks, analysis)
        if img_path:
            generated.append(str(img_path))

    LOGGER.info(f"Generated {len(generated)} review sheets")
    return generated


def main():
    """Generate all outputs."""
    LOGGER.info("Generating outputs...")

    # Load analyses
    analyses = load_all_analyses()
    if not analyses:
        LOGGER.error("No analyses found. Run detect_cycles.py first.")
        return

    # Generate coverage report
    md_report, csv_path = generate_coverage_report(analyses)
    md_path = OUTPUT_DIR / "coverage_report.md"
    with open(md_path, "w") as f:
        f.write(md_report)
    LOGGER.info(f"Coverage report saved to {md_path} and {csv_path}")

    # Generate review sheets
    generate_review_sheets(analyses)

    LOGGER.info("Output generation complete")


if __name__ == "__main__":
    main()