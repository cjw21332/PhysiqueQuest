"""Local ffmpeg + MediaPipe Tasks + unchanged TypeScript counter replay.

No browser, HTTP server, downloaded assets, inferred labels or copied counter.
Python Tasks CPU timing is NOT browser-WASM/native-phone timing.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import time


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--exercise-id", required=True)
    parser.add_argument("--file-match", required=True)
    parser.add_argument("--bridge", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--ffmpeg")
    parser.add_argument("--fps", type=float, default=10, help="Replay sample rate; use 15 for the native fast-pattern target")
    parser.add_argument("--smoke", action="store_true", help="3-frame infrastructure probe, never a scored baseline")
    args = parser.parse_args()
    if not 0 < args.fps <= 60:
        parser.error("--fps must be greater than zero and at most 60")
    import cv2
    import mediapipe as mp
    import numpy as np
    repo = Path.cwd()
    records = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    matches = [row for row in records if Path(row["file"]).name == args.file_match]
    if len(matches) != 1:
        raise ValueError("--file-match must select exactly one filename")
    label = matches[0]
    if not args.smoke:
        if any(type(label[key]) is not int or label[key] < 0 for key in ("full_reps", "partial_reps")):
            raise ValueError("Reviewed full_reps and partial_reps are required; null is not zero")
    video = Path(label["file"])
    model = repo / "frontend/public/pose/pose_landmarker_lite.task"
    if args.ffmpeg:
        ffmpeg = Path(args.ffmpeg)
    else:
        # The optional imageio wrapper requires pkg_resources on some installs.
        # Use its already-installed bundled executable directly; never download.
        module = importlib.util.find_spec("imageio_ffmpeg")
        candidates = list((Path(module.origin).parent / "binaries").glob("ffmpeg*.exe")) if module else []
        if len(candidates) != 1:
            raise RuntimeError("Specify an existing local --ffmpeg executable")
        ffmpeg = candidates[0]
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=False)
    capture = cv2.VideoCapture(str(video))
    width, height = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH)), int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    source_fps = capture.get(cv2.CAP_PROP_FPS)
    capture.release()
    if width <= 0 or height <= 0:
        raise RuntimeError("Could not read video dimensions locally")
    scaled_width = min(480, width)
    scaled_height = max(2, round(height * scaled_width / width / 2) * 2)
    command = [str(ffmpeg), "-nostdin", "-v", "error", "-i", str(video), "-vf", f"fps={args.fps},scale={scaled_width}:{scaled_height}"]
    if args.smoke:
        command += ["-frames:v", "3"]
    command += ["-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"]
    provenance = {"status": "running", "smokeOnly": args.smoke, "video": str(video), "videoBytes": video.stat().st_size,
        "videoSha256": hashlib.sha256(video.read_bytes()).hexdigest(), "model": str(model),
        "modelSha256": hashlib.sha256(model.read_bytes()).hexdigest(), "mediapipeVersion": mp.__version__,
        "pythonVersion": sys.version, "ffmpegCommand": command, "sourceFps": source_fps,
        "counterExerciseId": args.exercise_id, "sourceHashes": {name: hashlib.sha256((repo/name).read_bytes()).hexdigest()
            for name in ("shared/exerciseEngine.ts", "shared/poseConfig.ts", "shared/poseSubject.ts", "shared/landmarkFilter.ts", "backend/src/pose-tracker/catalog-tracking.generated.ts")},
        "limitations": ["Python MediaPipe Tasks CPU backend differs from app browser WASM and native camera; performance is backend-specific.",
            "No camera, native start gate, spoken cues, React rendering or live frame scheduling is exercised.",
            f"{args.fps:g} Hz resampling is intentional sampling, not measured live dropped frames."]}
    (output/"provenance.json").write_text(json.dumps(provenance, indent=2), encoding="utf-8")
    bridge = subprocess.Popen(["node", str(Path(args.bridge).resolve())], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", cwd=repo)
    def request(message):
        bridge.stdin.write(json.dumps(message)+"\n"); bridge.stdin.flush()
        line = bridge.stdout.readline()
        if not line:
            raise RuntimeError("Counter bridge exited: "+bridge.stderr.read())
        result = json.loads(line)
        if "error" in result:
            raise RuntimeError(result["error"])
        return result
    decoder = None
    try:
        configuration = request({"type": "init", "exerciseId": args.exercise_id})
        (output/"configuration.json").write_text(json.dumps(configuration, indent=2), encoding="utf-8")
        options = mp.tasks.vision.PoseLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=str(model), delegate=mp.tasks.BaseOptions.Delegate.CPU),
            running_mode=mp.tasks.vision.RunningMode.VIDEO, num_poses=3,
            min_pose_detection_confidence=.6, min_pose_presence_confidence=.6, min_tracking_confidence=.6,
            output_segmentation_masks=False)
        durations, missing, frames, cue_events = [], 0, 0, []
        snapshot = None
        with tempfile.TemporaryFile() as stderr, mp.tasks.vision.PoseLandmarker.create_from_options(options) as detector, (output/"frames.jsonl").open("w", encoding="utf-8") as trace:
            decoder = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=stderr)
            frame_bytes = scaled_width * scaled_height * 3
            while True:
                data = bytearray()
                while len(data) < frame_bytes:
                    chunk = decoder.stdout.read(frame_bytes-len(data))
                    if not chunk:
                        break
                    data.extend(chunk)
                if not data:
                    break
                if len(data) != frame_bytes:
                    raise RuntimeError("Truncated decoded RGB frame")
                rgb = np.frombuffer(data, dtype=np.uint8).reshape(scaled_height, scaled_width, 3).copy()
                timestamp = round(frames * 1000 / args.fps) + 1
                started = time.perf_counter()
                result = detector.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), timestamp)
                duration = (time.perf_counter()-started)*1000
                poses = [[{"x": p.x, "y": p.y, "z": p.z, "visibility": p.visibility, "presence": p.presence} for p in pose] for pose in result.pose_landmarks]
                evaluated = request({"type": "frame", "poses": poses, "timestampMs": timestamp, "aspect": scaled_width/scaled_height})
                evaluated.update({"frameNumber": frames, "inferenceMs": duration, "inputWidth": scaled_width, "inputHeight": scaled_height})
                trace.write(json.dumps(evaluated)+"\n")
                durations.append(duration); missing += int(evaluated["missingWorkingTriplet"])
                cue_events.extend(evaluated["emittedFormCues"]); snapshot = evaluated["snapshot"]; frames += 1
            code = decoder.wait()
            stderr.seek(0)
            decoder_error = stderr.read().decode("utf-8", errors="replace")
            if code:
                raise RuntimeError(f"ffmpeg exit {code}: {decoder_error}")
        if frames == 0:
            raise RuntimeError("No video frames were decoded")
        summary = {"status": "infrastructure-smoke-only" if args.smoke else "unvalidated-replay", "processedFrames": frames,
            "missingWorkingTripletFrames": missing, "inferenceP95Ms": sorted(durations)[max(0, int(np.ceil(.95*len(durations)))-1)],
            "fullRepsDetected": snapshot["reps"], "partialRepsDetected": snapshot["partials"],
            "fullCountError": None if args.smoke else snapshot["reps"]-label["full_reps"],
            "partialCountError": None if args.smoke else snapshot["partials"]-label["partial_reps"],
            "falseCueRate": None, "falseCueRateReason": "Requires independent rule/time correctness annotations; totals are insufficient",
            "formCueEvents": len(cue_events), "cameraRestarts": None, "thermalState": None, "memoryGrowth": None,
            "validated": False, "limitations": provenance["limitations"]}
        (output/"summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
        print(json.dumps(summary, indent=2))
    except Exception as error:
        import traceback
        (output/"error.txt").write_text(traceback.format_exc(), encoding="utf-8")
        raise
    finally:
        if decoder is not None and decoder.poll() is None:
            decoder.terminate(); decoder.wait()
        bridge.stdin.close()
        try:
            bridge.wait(timeout=5)
        except subprocess.TimeoutExpired:
            bridge.terminate(); bridge.wait()


if __name__ == "__main__":
    main()
