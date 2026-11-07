"""
Landmark Extraction Module

Runs MediaPipe Pose Landmarker on each GIF frame, stores landmarks per frame.
"""

import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from tqdm import tqdm
import json

from config import (
    GIF_CACHE_DIR,
    LANDMARK_CACHE_DIR,
    MEDIAPIPE_MODEL_COMPLEXITY,
    MEDIAPIPE_MIN_DETECTION_CONFIDENCE,
    MEDIAPIPE_MIN_PRESENCE_CONFIDENCE,
    MEDIAPIPE_MIN_TRACKING_CONFIDENCE,
    MEDIAPIPE_NUM_POSES,
    LOGGER,
)


@dataclass
class FrameLandmarks:
    frame_idx: int
    timestamp_ms: float
    landmarks: List[Dict[str, float]]  # list of {x, y, z, visibility, presence}
    person_detected: bool


@dataclass
class ExerciseLandmarks:
    exerciseId: str
    fps: float
    frame_count: int
    duration_ms: float
    frames: List[FrameLandmarks]
    person_detected_fraction: float


def get_mediapipe_model_path() -> str:
    """Get path to MediaPipe pose landmarker model."""
    return str(Path(__file__).parent / 'models' / 'pose_landmarker_heavy.task')


def create_landmarker():
    """Create MediaPipe PoseLandmarker instance."""
    base_options = mp_python.BaseOptions(
        model_asset_path=get_mediapipe_model_path(),
        delegate=mp_python.BaseOptions.Delegate.CPU,
    )
    options = vision.PoseLandmarkerOptions(
        base_options=base_options,
        running_mode=vision.RunningMode.VIDEO,
        num_poses=MEDIAPIPE_NUM_POSES,
        min_pose_detection_confidence=MEDIAPIPE_MIN_DETECTION_CONFIDENCE,
        min_pose_presence_confidence=MEDIAPIPE_MIN_PRESENCE_CONFIDENCE,
        min_tracking_confidence=MEDIAPIPE_MIN_TRACKING_CONFIDENCE,
        output_segmentation_masks=False,
    )
    return vision.PoseLandmarker.create_from_options(options)


def extract_gif_frames(gif_path: Path) -> Tuple[List[np.ndarray], List[float], float]:
    """
    Extract all frames from a GIF with their durations.

    Returns:
        frames: List of BGR images (numpy arrays)
        timestamps_ms: List of cumulative timestamps in milliseconds
        fps: Average frames per second
    """
    frames = []
    durations = []

    # Use OpenCV to read GIF
    cap = cv2.VideoCapture(str(gif_path))
    if not cap.isOpened():
        raise ValueError(f"Could not open GIF: {gif_path}")

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        frames.append(frame)

        # Get frame duration (in ms)
        # OpenCV doesn't directly expose GIF frame delays
        # We'll use the video FPS as approximation
        fps = cap.get(cv2.CAP_PROP_FPS)
        if fps <= 0:
            fps = 10.0  # default fallback

    cap.release()

    if not frames:
        raise ValueError(f"No frames extracted from GIF: {gif_path}")

    # Calculate timestamps
    frame_duration_ms = 1000.0 / fps if fps > 0 else 100.0
    timestamps_ms = [i * frame_duration_ms for i in range(len(frames))]

    return frames, timestamps_ms, fps


def landmarks_to_dict(landmarks) -> List[Dict[str, float]]:
    """Convert MediaPipe landmarks to list of dicts."""
    result = []
    for lm in landmarks:
        result.append({
            "x": lm.x,
            "y": lm.y,
            "z": lm.z,
            "visibility": lm.visibility,
            "presence": lm.presence,
        })
    return result


def process_exercise_gif(exercise_id: str, gif_path: Path) -> ExerciseLandmarks:
    """Process a single exercise GIF through MediaPipe."""
    LOGGER.info(f"Processing {exercise_id}")

    # Extract frames
    frames, timestamps_ms, fps = extract_gif_frames(gif_path)
    frame_count = len(frames)

    # Create landmarker
    landmarker = create_landmarker()

    # Process each frame
    frame_landmarks = []
    person_detected_count = 0

    for i, (frame, timestamp) in enumerate(zip(frames, timestamps_ms)):
        # Convert BGR to RGB
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        # Create MediaPipe Image
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)

        # Detect (VIDEO mode uses timestamp)
        result = landmarker.detect_for_video(mp_image, int(timestamp))

        # Check if person detected
        person_detected = len(result.pose_landmarks) > 0
        if person_detected:
            person_detected_count += 1
            landmarks = landmarks_to_dict(result.pose_landmarks[0])
        else:
            landmarks = []

        frame_landmarks.append(FrameLandmarks(
            frame_idx=i,
            timestamp_ms=timestamp,
            landmarks=landmarks,
            person_detected=person_detected,
        ))

    person_fraction = person_detected_count / frame_count if frame_count > 0 else 0.0
    duration_ms = timestamps_ms[-1] if timestamps_ms else 0.0

    return ExerciseLandmarks(
        exerciseId=exercise_id,
        fps=fps,
        frame_count=frame_count,
        duration_ms=duration_ms,
        frames=frame_landmarks,
        person_detected_fraction=person_fraction,
    )


def save_landmarks(landmarks: ExerciseLandmarks):
    """Save landmarks to compressed NPZ file."""
    output_path = LANDMARK_CACHE_DIR / f"{landmarks.exerciseId}.npz"

    # Prepare arrays for NPZ
    frame_indices = np.array([f.frame_idx for f in landmarks.frames], dtype=np.int32)
    timestamps = np.array([f.timestamp_ms for f in landmarks.frames], dtype=np.float32)
    person_detected = np.array([f.person_detected for f in landmarks.frames], dtype=bool)

    # Landmarks: (n_frames, 33, 5) - x, y, z, visibility, presence
    # Use NaN for missing landmarks
    n_frames = len(landmarks.frames)
    landmarks_array = np.full((n_frames, 33, 5), np.nan, dtype=np.float32)

    for i, frame in enumerate(landmarks.frames):
        for j, lm in enumerate(frame.landmarks):
            if j < 33:
                landmarks_array[i, j, 0] = lm["x"]
                landmarks_array[i, j, 1] = lm["y"]
                landmarks_array[i, j, 2] = lm["z"]
                landmarks_array[i, j, 3] = lm["visibility"]
                landmarks_array[i, j, 4] = lm["presence"]

    np.savez_compressed(
        output_path,
        exerciseId=landmarks.exerciseId,
        fps=landmarks.fps,
        frame_count=landmarks.frame_count,
        duration_ms=landmarks.duration_ms,
        person_detected_fraction=landmarks.person_detected_fraction,
        frame_indices=frame_indices,
        timestamps=timestamps,
        person_detected=person_detected,
        landmarks=landmarks_array,
    )

    LOGGER.info(f"Saved landmarks for {landmarks.exerciseId} to {output_path}")


def load_landmarks(exercise_id: str) -> Optional[ExerciseLandmarks]:
    """Load landmarks from NPZ file."""
    path = LANDMARK_CACHE_DIR / f"{exercise_id}.npz"
    if not path.exists():
        return None

    data = np.load(path, allow_pickle=True)
    frames = []
    for i in range(len(data["frame_indices"])):
        # Reconstruct landmarks
        lm_data = data["landmarks"][i]
        landmarks_list = []
        for j in range(33):
            if not np.isnan(lm_data[j, 0]):
                landmarks_list.append({
                    "x": float(lm_data[j, 0]),
                    "y": float(lm_data[j, 1]),
                    "z": float(lm_data[j, 2]),
                    "visibility": float(lm_data[j, 3]),
                    "presence": float(lm_data[j, 4]),
                })
            else:
                break
        frames.append(FrameLandmarks(
            frame_idx=int(data["frame_indices"][i]),
            timestamp_ms=float(data["timestamps"][i]),
            landmarks=landmarks_list,
            person_detected=bool(data["person_detected"][i]),
        ))

    return ExerciseLandmarks(
        exerciseId=str(data["exerciseId"]),
        fps=float(data["fps"]),
        frame_count=int(data["frame_count"]),
        duration_ms=float(data["duration_ms"]),
        frames=frames,
        person_detected_fraction=float(data["person_detected_fraction"]),
    )


def main():
    """Process all cached GIFs through MediaPipe."""
    LOGGER.info("Starting landmark extraction pipeline")

    # Find all cached GIFs
    gif_files = list(GIF_CACHE_DIR.glob("*.gif"))
    LOGGER.info(f"Found {len(gif_files)} cached GIFs")

    # Process each
    results = []
    for gif_path in tqdm(gif_files, desc="Extracting landmarks"):
        exercise_id = gif_path.stem
        npz_path = LANDMARK_CACHE_DIR / f"{exercise_id}.npz"

        # Skip if already processed
        if npz_path.exists():
            LOGGER.debug(f"Skipping {exercise_id} (already processed)")
            results.append(exercise_id)
            continue

        try:
            landmarks = process_exercise_gif(exercise_id, gif_path)
            save_landmarks(landmarks)
            results.append(exercise_id)
        except Exception as e:
            LOGGER.error(f"Failed to process {exercise_id}: {e}")

    LOGGER.info(f"Landmark extraction complete: {len(results)} exercises processed")

    # Save summary
    summary = {
        "total_gifs": len(gif_files),
        "processed": len(results),
        "exercises": results,
    }
    summary_path = LANDMARK_CACHE_DIR.parent / "landmark_summary.json"
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2)
    LOGGER.info(f"Summary saved to {summary_path}")


if __name__ == "__main__":
    main()
