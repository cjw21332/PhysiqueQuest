"""N1: isolate each resolution/detector and report actual pose detections."""
from pathlib import Path
import cv2
import numpy as np
import mediapipe as mp

ROOT = Path(__file__).resolve().parents[2]
MODEL = ROOT / 'ml/models/pose_landmarker_lite.task'
VIDEO = next((ROOT / 'ml/data/raw/real_video/pushupbench').glob('01e83deb_0015*.mp4'))
PHOTO = ROOT / 'images.jpg'

def fit(frame, width, height):
    h, w = frame.shape[:2]; scale = min(width/w, height/h)
    nw, nh = max(1, round(w*scale)), max(1, round(h*scale))
    resized = cv2.resize(frame, dsize=(nw, nh), interpolation=cv2.INTER_AREA if scale < 1 else cv2.INTER_LINEAR)
    canvas = np.zeros((height, width, 3), dtype=np.uint8)
    x, y = (width-nw)//2, (height-nh)//2
    canvas[y:y+nh,x:x+nw] = resized
    return np.ascontiguousarray(cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB), dtype=np.uint8)

def detector(mode):
    options = mp.tasks.vision.PoseLandmarkerOptions(base_options=mp.tasks.BaseOptions(model_asset_path=str(MODEL)), running_mode=mode, min_pose_detection_confidence=.6, min_pose_presence_confidence=.6, min_tracking_confidence=.6)
    return mp.tasks.vision.PoseLandmarker.create_from_options(options)

cap = cv2.VideoCapture(str(VIDEO)); width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)); height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)); fps = cap.get(cv2.CAP_PROP_FPS)
frames=[]
while len(frames) < 30:
    ok, frame = cap.read()
    if not ok: break
    frames.append(frame)
cap.release()
photo = cv2.imread(str(PHOTO))
if not frames or photo is None: raise RuntimeError('Missing video frames or control photo')
print(f'video={VIDEO.name} source={width}x{height} fps={fps:.3f} frames={len(frames)}')
print(f'control={PHOTO.name} source={photo.shape[1]}x{photo.shape[0]}')
print('resolution,video_detected,video_total,video_rate,photo_detected,photo_total,photo_rate')
for w,h in [(1280,720),(960,540),(640,360),(640,480),(480,270)]:
    with detector(mp.tasks.vision.RunningMode.VIDEO) as d:
        hits=0
        for i, frame in enumerate(frames):
            img = mp.Image(image_format=mp.ImageFormat.SRGB,data=fit(frame,w,h))
            hits += bool(d.detect_for_video(img,round(i*1000/fps)).pose_landmarks)
    with detector(mp.tasks.vision.RunningMode.IMAGE) as d:
        control = int(bool(d.detect(mp.Image(image_format=mp.ImageFormat.SRGB,data=fit(photo,w,h))).pose_landmarks))
    print(f'{w}x{h},{hits},{len(frames)},{100*hits/len(frames):.1f}%,{control},1,{100*control:.1f}%',flush=True)
