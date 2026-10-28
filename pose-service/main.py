import base64
import binascii
import hmac
import json
import math
import os
import tempfile
import threading
import time
from pathlib import Path

import cv2
import mediapipe as mp
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from starlette.concurrency import run_in_threadpool

MAX_BODY = 28_000_500
MAX_VIDEO = 20 * 1024 * 1024
MODEL = os.environ.get('POSE_MODEL_PATH', str(Path(__file__).resolve().parent.parent / 'frontend/public/pose/pose_landmarker_lite.task'))
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
slot = threading.BoundedSemaphore(1)


def estimate_cycles(timeline: list, exercise: str | None) -> dict | None:
    if exercise not in ('chest_press', 'squat') or len(timeline) < 12:
        return None
    names = ('left_elbow', 'right_elbow') if exercise == 'chest_press' else ('left_knee', 'right_knee')
    # shortcut: one visible joint cannot validate form; upgrade after exercise-specific labeled evaluation.
    values = [max((sample[name] for name in names if name in sample), default=None) for sample in timeline]
    if any(value is None for value in values) or len(values) < 12:
        return None
    smooth = [sorted(values[max(0, i - 1):min(len(values), i + 2)])[len(values[max(0, i - 1):min(len(values), i + 2)]) // 2] for i in range(len(values))]
    low, high = min(smooth), max(smooth)
    if high - low < 35:
        return None
    lower, upper = low + (high - low) * .35, low + (high - low) * .65
    state, cycles = 'seek_high', 0
    for value in smooth:
        if state == 'seek_high' and value >= upper:
            state = 'seek_low'
        elif state == 'seek_low' and value <= lower:
            state = 'return_high'
        elif state == 'return_high' and value >= upper:
            cycles += 1
            state = 'seek_low'
    if cycles < 2:
        return None
    return {'exercise': exercise, 'estimatedReps': cycles, 'method': 'joint_angle_cycles'}


def analyze_video(video: bytes, exercise_hint: str | None = None) -> dict:
    path = None
    capture = None
    try:
        with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as output:
            path = output.name
            output.write(video)
        capture = cv2.VideoCapture(path)
        if not capture.isOpened():
            raise ValueError('Video could not be decoded')
        fps = capture.get(cv2.CAP_PROP_FPS)
        count = capture.get(cv2.CAP_PROP_FRAME_COUNT)
        width = capture.get(cv2.CAP_PROP_FRAME_WIDTH)
        height = capture.get(cv2.CAP_PROP_FRAME_HEIGHT)
        if not all(math.isfinite(value) for value in (fps, count, width, height)) or not 0 < fps <= 120 or not 0 < count <= 14400 or count / fps > 120.5 or not 0 < width <= 4096 or not 0 < height <= 4096:
            raise ValueError('Video duration could not be verified')
        options = vision.PoseLandmarkerOptions(base_options=python.BaseOptions(model_asset_path=MODEL), running_mode=vision.RunningMode.VIDEO, num_poses=1)
        frames = detected = index = 0
        angles = {name: [] for name in ('left_elbow', 'right_elbow', 'left_knee', 'right_knee')}
        timeline = []
        review_frames = []
        frame_interval = max(1, math.ceil(count / 24))
        deadline = time.monotonic() + 45
        step = max(1, math.ceil(fps / 4))
        with vision.PoseLandmarker.create_from_options(options) as detector:
            while True:
                if time.monotonic() > deadline:
                    raise TimeoutError('Analysis exceeded its time limit')
                ok, frame = capture.read()
                if not ok:
                    break
                if index % frame_interval == 0 and len(review_frames) < 24:
                    h, w = frame.shape[:2]
                    scale = min(1, 480 / max(h, w))
                    preview = cv2.resize(frame, (max(1, round(w * scale)), max(1, round(h * scale))))
                    encoded, jpeg = cv2.imencode('.jpg', preview, [cv2.IMWRITE_JPEG_QUALITY, 65])
                    if encoded:
                        review_frames.append({'timeSeconds': round(index / fps, 2), 'jpeg': base64.b64encode(jpeg).decode('ascii')})
                if index % step == 0:
                    height, width = frame.shape[:2]
                    if max(height, width) > 640:
                        ratio = 640 / max(height, width)
                        frame = cv2.resize(frame, (max(1, round(width * ratio)), max(1, round(height * ratio))))
                    image = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                    result = detector.detect_for_video(image, round(index * 1000 / fps))
                    frames += 1
                    detected += bool(result.pose_landmarks)
                    sample = {'timeSeconds': round(index / fps, 2)}
                    if result.pose_world_landmarks:
                        points = result.pose_world_landmarks[0]
                        for name, indices in {'left_elbow': (11, 13, 15), 'right_elbow': (12, 14, 16), 'left_knee': (23, 25, 27), 'right_knee': (24, 26, 28)}.items():
                            a, b, c = (points[i] for i in indices)
                            if min(a.visibility or 0, b.visibility or 0, c.visibility or 0) < .65:
                                continue
                            ba = (a.x - b.x, a.y - b.y, a.z - b.z)
                            bc = (c.x - b.x, c.y - b.y, c.z - b.z)
                            denominator = math.sqrt(sum(x*x for x in ba) * sum(x*x for x in bc))
                            if denominator > 1e-8:
                                angle = math.degrees(math.acos(max(-1, min(1, sum(x*y for x, y in zip(ba, bc)) / denominator))))
                                angles[name].append(angle)
                                sample[name] = round(angle)
                    timeline.append(sample)
                index += 1
        if not frames or index < max(1, count * .9):
            raise ValueError('Video could not be fully decoded')
        coverage = round(100 * detected / frames)
        observations = [f'Pose landmarks were detected in {detected} of {frames} sampled frames ({coverage}%).']
        observations.append('Landmark detection is an estimate; this does not assess form or count repetitions.')
        if coverage < 50:
            observations.append('Pose visibility was limited. Try a clear, well-lit recording with your body in view.')
        joints = [{'joint': name, 'minAngle': round(min(values)), 'maxAngle': round(max(values)), 'visibleFrames': len(values)} for name, values in angles.items() if len(values) >= max(3, math.ceil(frames * .25))]
        return {'observations': observations, 'metrics': {'durationSeconds': round(index / fps, 1), 'sampledFrames': frames, 'detectedFrames': detected, 'joints': joints}, 'movementEstimate': estimate_cycles(timeline, exercise_hint), '_reviewFrames': review_frames, '_timeline': timeline}
    finally:
        if capture is not None:
            capture.release()
        if path is not None:
            try:
                os.unlink(path)
            except FileNotFoundError:
                pass


@app.get('/health')
def health():
    return {'available': len(os.environ.get('POSE_ANALYSIS_API_KEY', '')) >= 32 and Path(MODEL).is_file()}


@app.post('/analyze')
async def analyze(request: Request):
    secret = os.environ.get('POSE_ANALYSIS_API_KEY', '')
    supplied = request.headers.get('authorization', '')
    if len(secret) < 32 or not hmac.compare_digest(supplied.encode(), f'Bearer {secret}'.encode()):
        return JSONResponse({'message': 'Unauthorized'}, status_code=401)
    if not slot.acquire(blocking=False):
        return JSONResponse({'message': 'Analysis is busy; try again.'}, status_code=503)
    try:
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > MAX_BODY:
                raise HTTPException(413, 'Request too large')
        try:
            payload = json.loads(body)
            if not isinstance(payload, dict) or payload.get('mimeType') not in ('video/mp4', 'video/quicktime') or payload.get('analysisType', 'workout') != 'workout':
                raise ValueError()
            if payload.get('exerciseHint') not in (None, 'chest_press', 'squat'):
                raise ValueError()
            video = base64.b64decode(payload['mediaBase64'], validate=True)
            if not video or len(video) > MAX_VIDEO:
                raise ValueError()
        except (ValueError, KeyError, TypeError, binascii.Error):
            raise HTTPException(400, 'Invalid video request')
        try:
            return {'analysis': await run_in_threadpool(analyze_video, video, payload.get('exerciseHint'))}
        except ValueError:
            raise HTTPException(400, 'Video could not be decoded or its duration verified')
        except TimeoutError:
            raise HTTPException(503, 'Video analysis timed out')
        except Exception:
            raise HTTPException(503, 'Video analysis is unavailable')
    finally:
        slot.release()
