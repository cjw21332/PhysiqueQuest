"""Local research extraction only; never imported by the app or used to train a model."""
import argparse
import hashlib
import importlib.metadata
import json
import math
from pathlib import Path
import re
import time


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("video_id", help="Pinned benchmark video ID, e.g. 0006")
    args = parser.parse_args()
    if not re.fullmatch(r"\d+", args.video_id):
        parser.error("Video ID must contain digits only")
    import cv2
    import mediapipe as mp
    from mediapipe.tasks import python
    from mediapipe.tasks.python import vision

    root = Path(__file__).resolve().parent.parent
    directory = root / "research-data" / "qevd"
    manifest = json.loads((directory / "manifest.proposed.json").read_text(encoding="utf-8"))
    if manifest["purpose"] != "held-out-evaluation-only" or manifest["releaseCleared"] is not False:
        raise ValueError("Expected research-only manifest")
    video = next(item for item in manifest["videos"] if item["videoId"] == args.video_id)
    video_path = directory / "data" / f"{args.video_id}.mp4"
    model_path = root / "mobile" / "assets" / "pose_landmarker_lite.task"
    digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
    options = vision.PoseLandmarkerOptions(
        base_options=python.BaseOptions(model_asset_path=str(model_path)),
        running_mode=vision.RunningMode.VIDEO, num_poses=1,
        min_pose_detection_confidence=0.6, min_pose_presence_confidence=0.6,
        min_tracking_confidence=0.6, output_segmentation_masks=False,
    )
    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        raise ValueError("Could not open local video; prepare it with --video first")
    fps = capture.get(cv2.CAP_PROP_FPS)
    if not math.isfinite(fps) or abs(fps - video["fps"]) > 0.01:
        capture.release()
        raise ValueError("Video timebase differs from pinned annotations")
    frames, inference_ms = [], []
    frame_index, next_ms = 0, 0.0
    started = time.perf_counter()
    try:
        with vision.PoseLandmarker.create_from_options(options) as detector:
            while True:
                ok, bgr = capture.read()
                if not ok:
                    break
                timestamp = frame_index / fps * 1000
                frame_index += 1
                if timestamp + 0.001 < next_ms:
                    continue
                next_ms += 100  # 10 Hz, no artificial interpolation of missing detections.
                rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
                image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                before = time.perf_counter()
                result = detector.detect_for_video(image, round(timestamp))
                inference_ms.append((time.perf_counter() - before) * 1000)
                joints = [{"x": point.x, "y": point.y, "visibility": point.visibility,
                           "presence": point.presence} for point in result.pose_landmarks[0]] if result.pose_landmarks else []
                world = [{"x": point.x, "y": point.y, "z": point.z}
                         for point in result.pose_world_landmarks[0]] if result.pose_world_landmarks else []
                frames.append({"timestamp": round(timestamp), "aspect": rgb.shape[1] / rgb.shape[0],
                               "joints": joints, "worldJoints": world})
    finally:
        capture.release()
    if abs(frame_index - video["frameCount"]) > 1 or not frames:
        raise ValueError("Decoded video does not match pinned frame count")
    report = {"purpose": manifest["purpose"], "revision": manifest["revision"], "videoId": args.video_id,
              "videoSha256": digest(video_path), "modelSha256": digest(model_path), "samplingHz": 10,
              "runtime": {"mediapipe": importlib.metadata.version("mediapipe"), "opencv": cv2.__version__},
              "extraction": {"sampledFrames": len(frames), "missingPoseFrames": sum(not f["joints"] for f in frames),
                             "wallSeconds": time.perf_counter() - started,
                             "meanInferenceMs": sum(inference_ms) / len(inference_ms),
                             "note": "Desktop Python extraction timing; not Android/web latency or battery evidence."},
              "frames": frames}
    (directory / f"poses-{args.video_id}.json").write_text(json.dumps(report, allow_nan=False), encoding="utf-8")
    print(json.dumps(report["extraction"], indent=2))


if __name__ == "__main__":
    main()
