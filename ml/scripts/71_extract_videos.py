#!/usr/bin/env python3
"""Spec-compliant keypoint extraction for local video datasets.

Implements ml/FEATURE_SPEC.md steps 1-3 exactly and identically for every
dataset, so training and evaluation see the same features:

  1. pad frame to 1.5x with the (0,0) pixel colour, paste at offset 0.25
  2. run MediaPipe PoseLandmarker (VIDEO mode) on the padded frame
  3. un-pad: x' = 1.5x - 0.25, y' = 1.5y - 0.25, z' = 1.5z
  4. normalise: centre on mid-hip, divide by mid-shoulder-to-mid-hip distance
  5. resample every joint/coordinate to a fixed 15 fps grid

Frames are decoded at 480 px width (normalised coordinates are resolution
independent), which keeps CPU extraction tractable.

Output: one compressed npz per video in --out
  landmarks      (T, 33, 4) float32   normalised x, y, z, visibility
  timestamps_ms  (T,)        float64   15 fps grid, video-relative
  detection_mask (T,)        bool      pose present on that sampled frame
  width, height, source_width, source_height, fps, normalized, pad_factor

Resumable: existing outputs are skipped. Re-run after a crash and it
continues where it stopped.
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np

ML = Path(__file__).resolve().parents[1]
MODEL = ML / "models" / "pose_landmarker_lite.task"
PAD_FACTOR = 1.5
OFFSET = (PAD_FACTOR - 1.0) / 2.0
TARGET_FPS = 15.0
VIDEO_EXT = {".mp4", ".mov", ".avi", ".mkv", ".webm"}


def pad_image(rgb: np.ndarray) -> np.ndarray:
    h, w = rgb.shape[:2]
    canvas_w, canvas_h = int(w * PAD_FACTOR), int(h * PAD_FACTOR)
    fill = rgb[0, 0].tolist()
    canvas = np.empty((canvas_h, canvas_w, 3), dtype=np.uint8)
    canvas[:, :] = fill
    ox, oy = int(w * OFFSET), int(h * OFFSET)
    canvas[oy:oy + h, ox:ox + w] = rgb
    return np.ascontiguousarray(canvas)


def unpad_and_normalize(kps: np.ndarray) -> np.ndarray | None:
    """Map padded-image coords back to the frame, then normalise.

    Returns (33, 4) float32 or None when the pose is degenerate
    (zero torso length), which the caller records as a missed detection.
    """
    out = kps.copy().astype(np.float32)
    out[:, 0] = out[:, 0] * PAD_FACTOR - OFFSET
    out[:, 1] = out[:, 1] * PAD_FACTOR - OFFSET
    out[:, 2] = out[:, 2] * PAD_FACTOR

    mid_hip = (out[23] + out[24]) / 2.0
    mid_shoulder = (out[11] + out[12]) / 2.0
    torso = float(np.hypot(*(mid_hip[:2] - mid_shoulder[:2])))
    if not np.isfinite(torso) or torso < 1e-6:
        return None
    out = (out - mid_hip) / torso
    if not np.all(np.isfinite(out)):
        return None
    return out


def resample(landmarks: np.ndarray, times_ms: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Linear-interpolate every joint coordinate onto a uniform 15 fps grid."""
    duration_s = float(times_ms[-1] - times_ms[0]) / 1000.0
    n = max(2, int(round(duration_s * TARGET_FPS)))
    grid = np.linspace(float(times_ms[0]), float(times_ms[-1]), n)
    src = np.asarray(times_ms, dtype=np.float64)
    out = np.empty((n, 33, 4), dtype=np.float32)
    for joint in range(33):
        for coord in range(4):
            out[:, joint, coord] = np.interp(grid, src, landmarks[:, joint, coord]).astype(np.float32)
    return out, grid


def extract_video(path: Path, out_dir: Path, max_width: int = 480) -> dict:
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise RuntimeError(f"cannot open {path}")
    fps = float(cap.get(cv2.CAP_PROP_FPS))
    if not np.isfinite(fps) or fps <= 0:
        cap.release()
        raise RuntimeError(f"invalid fps for {path}")

    options = mp.tasks.vision.PoseLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(
            model_asset_path=str(MODEL),
            delegate=mp.tasks.BaseOptions.Delegate.CPU,
        ),
        running_mode=mp.tasks.vision.RunningMode.VIDEO,
        min_pose_detection_confidence=0.3,
        min_pose_presence_confidence=0.3,
        min_tracking_confidence=0.3,
        num_poses=1,
        output_segmentation_masks=False,
    )

    landmarks: list[np.ndarray] = []
    times: list[float] = []
    detected: list[bool] = []
    src_w = src_h = 0
    width = height = 0
    step_ms = 1000.0 / TARGET_FPS
    next_sample = 0.0
    index = 0

    with mp.tasks.vision.PoseLandmarker.create_from_options(options) as detector:
        while True:
            ok, bgr = cap.read()
            if not ok:
                break
            t_ms = index * 1000.0 / fps
            index += 1
            if t_ms + 1e-6 < next_sample:
                continue
            next_sample += step_ms

            src_h, src_w = bgr.shape[:2]
            width = min(max_width, src_w)
            height = max(1, int(round(src_h * width / src_w)))
            frame = cv2.resize(bgr, (width, height), interpolation=cv2.INTER_AREA)
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            padded = pad_image(rgb)

            result = detector.detect_for_video(
                mp.Image(image_format=mp.ImageFormat.SRGB, data=padded), int(round(t_ms))
            )
            found = bool(result.pose_landmarks)
            normalised = None
            if found:
                raw = np.array(
                    [[p.x, p.y, p.z, p.visibility] for p in result.pose_landmarks[0]],
                    dtype=np.float32,
                )
                if raw.shape == (33, 4):
                    normalised = unpad_and_normalize(raw)
            if normalised is None:
                landmarks.append(np.zeros((33, 4), dtype=np.float32))
                detected.append(False)
            else:
                landmarks.append(normalised)
                detected.append(True)
            times.append(t_ms)
    cap.release()

    if not landmarks:
        raise RuntimeError(f"no sampled frames in {path}")

    lm_raw = np.stack(landmarks).astype(np.float32)
    t_raw = np.asarray(times, dtype=np.float64)
    det_raw = np.asarray(detected, dtype=np.float32)
    lm_res, grid = resample(lm_raw, t_raw)
    det_res = np.interp(grid, t_raw, det_raw) > 0.5

    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / f"{path.stem}.npz"
    np.savez_compressed(
        target,
        landmarks=lm_res,
        timestamps_ms=grid,
        detection_mask=det_res,
        width=width,
        height=height,
        source_width=src_w,
        source_height=src_h,
        fps=fps,
        normalized=True,
        pad_factor=PAD_FACTOR,
    )
    return {
        "video": path.name,
        "out": target.name,
        "sampled": int(len(t_raw)),
        "resampled": int(lm_res.shape[0]),
        "detected_pct": round(100.0 * float(det_raw.mean()), 2),
        "duration_s": round(float(t_raw[-1] - t_raw[0]) / 1000.0, 2),
        "fps": round(fps, 2),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--videos", type=Path, default=ML / "data" / "raw" / "real_video" / "pushupbench")
    ap.add_argument("--out", type=Path, default=ML / "data" / "keypoints_pushupbench")
    ap.add_argument("--limit", type=int, default=0, help="stop after N newly extracted videos")
    ap.add_argument("--max-width", type=int, default=480)
    ap.add_argument("--force", action="store_true", help="re-extract existing outputs")
    args = ap.parse_args()

    if not MODEL.exists():
        print(f"missing model: {MODEL}", file=sys.stderr)
        return 2
    if not args.videos.is_dir():
        print(f"missing video dir: {args.videos}", file=sys.stderr)
        return 2

    videos = sorted(p for p in args.videos.iterdir() if p.is_file() and p.suffix.lower() in VIDEO_EXT)
    if not videos:
        print(f"no videos in {args.videos}", file=sys.stderr)
        return 2

    args.out.mkdir(parents=True, exist_ok=True)
    done = skipped = failed = 0
    started = time.time()
    for i, video in enumerate(videos, 1):
        target = args.out / f"{video.stem}.npz"
        if target.exists() and not args.force:
            skipped += 1
            continue
        try:
            info = extract_video(video, args.out, args.max_width)
            done += 1
            print(
                f"[{i}/{len(videos)}] {info['video']} "
                f"{info['resampled']}f @15fps det={info['detected_pct']}% "
                f"{info['duration_s']}s",
                flush=True,
            )
        except Exception as exc:  # keep going; report at the end
            failed += 1
            print(f"[{i}/{len(videos)}] FAILED {video.name}: {exc}", file=sys.stderr, flush=True)
        if args.limit and done >= args.limit:
            print(f"limit reached ({args.limit})")
            break

    elapsed = time.time() - started
    print(
        f"\nextracted={done} skipped={skipped} failed={failed} "
        f"elapsed={elapsed:.0f}s out={args.out}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
