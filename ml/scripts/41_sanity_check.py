#!/usr/bin/env python3
"""Task 2: Keypoint sanity check - visual skeleton overlay + angle plots."""
import json
import os
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageSequence
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision
from scipy.ndimage import gaussian_filter1d
from scipy.signal import find_peaks
from scipy.fft import fft, fftfreq

# ── Model ──────────────────────────────────────────────────────────────────
MODEL_PATH = Path("models/pose_landmarker_lite.task")
assert MODEL_PATH.exists(), f"Model not found: {MODEL_PATH}"

_vision = mp.tasks.vision
PoseLandmarker = _vision.PoseLandmarker
PoseLandmarkerOptions = _vision.PoseLandmarkerOptions
RunningMode = _vision.RunningMode

base_options = mp.tasks.BaseOptions(model_asset_path=str(MODEL_PATH), delegate=mp.tasks.BaseOptions.Delegate.CPU)
options = PoseLandmarkerOptions(
    base_options=base_options,
    running_mode=RunningMode.IMAGE,
    min_pose_detection_confidence=0.3,
    min_pose_presence_confidence=0.3,
    min_tracking_confidence=0.3,
    num_poses=1,
    output_segmentation_masks=False,
)
detector = PoseLandmarker.create_from_options(options)

# MediaPipe Pose connections (33 landmarks)
POSE_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 7), (0, 4), (4, 5), (5, 6), (6, 8),
    (9, 10), (11, 12), (11, 13), (13, 15), (15, 17), (15, 19), (15, 21),
    (17, 19), (12, 14), (14, 16), (16, 18), (16, 20), (16, 22), (18, 20),
    (11, 23), (12, 24), (23, 24), (23, 25), (25, 27), (27, 29), (29, 31),
    (24, 26), (26, 28), (28, 30), (30, 32)
]

# Primary joint for each pattern (landmark indices)
# Knee angle for squat/lunge: 24-26-28 (left hip-knee-ankle)
# Elbow angle for push/curl: 12-14-16 (right shoulder-elbow-wrist)
# Shoulder angle for lateral_raise: 12-14-16 (right shoulder-elbow-wrist) - actually need shoulder abduction
# Hip angle for plank: 24-26-28
PATTERN_PRIMARY_JOINTS = {
    'squat': ('knee', [24, 26, 28]),  # left hip-knee-ankle
    'horizontal_push': ('elbow', [12, 14, 16]),  # right shoulder-elbow-wrist
    'curl': ('elbow', [12, 14, 16]),
    'lateral_raise': ('shoulder', [12, 14, 16]),  # right shoulder abduction
    'lunge': ('knee', [24, 26, 28]),
    'core_isometric': ('hip', [24, 26, 28]),
}

def compute_angle(a, b, c):
    """Angle at b from a->b->c, returns degrees."""
    ba = a - b
    bc = c - b
    cosine = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-8)
    return np.degrees(np.arccos(np.clip(cosine, -1, 1)))

def extract_keypoints_from_frame(pil_rgb):
    """Run MediaPipe on PIL RGB, return (33,4) normalized keypoints or None."""
    arr = np.ascontiguousarray(np.asarray(pil_rgb, dtype=np.uint8))
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=arr)
    try:
        detection = detector.detect(mp_image)
    except Exception:
        return None
    if not detection or not detection.pose_landmarks:
        return None
    landmarks = detection.pose_landmarks[0] if isinstance(detection.pose_landmarks, list) else detection.pose_landmarks
    if not landmarks:
        return None
    kps = np.array([[l.x, l.y, l.z, l.visibility] for l in landmarks], dtype=np.float32)
    # Un-pad (PAD_FACTOR=1.5)
    offset = (1.5 - 1.0) / 2.0
    kps[:, 0] = kps[:, 0] * 1.5 - offset
    kps[:, 1] = kps[:, 1] * 1.5 - offset
    kps[:, 2] = kps[:, 2] * 1.5
    # Normalize: mid-hip center + torso-length scale
    hip = kps[[23, 24]]
    mid_hip = (hip[0] + hip[1]) / 2
    shoulder = kps[[11, 12]]
    mid_shoulder = (shoulder[0] + shoulder[1]) / 2
    kps_centered = kps - mid_hip
    torso_vec = mid_hip[:2] - mid_shoulder[:2]
    torso_len = np.hypot(torso_vec[0], torso_vec[1]) + 1e-6
    kps_normalized = kps_centered / torso_len
    return kps_normalized.astype(np.float32)

def load_gif_frames(gif_path):
    frames = []
    with Image.open(gif_path) as gif:
        for f in ImageSequence.Iterator(gif):
            rgba = f.convert("RGBA")
            bg = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
            frames.append(Image.alpha_composite(bg, rgba).convert("RGB"))
    return frames

def pad_image(im, factor=1.5):
    w, h = im.size
    corner_color = im.getpixel((0, 0))
    canvas = Image.new("RGB", (int(w * factor), int(h * factor)), corner_color)
    offset_x = int(w * (factor - 1) / 2)
    offset_y = int(h * (factor - 1) / 2)
    canvas.paste(im, (offset_x, offset_y))
    return canvas

def draw_skeleton(im, kps_33_4, out_path):
    """Draw skeleton on image and save."""
    draw = ImageDraw.Draw(im)
    w, h = im.size
    # Convert normalized keypoints back to pixel coords
    # kps are normalized by torso, centered at mid-hip
    # We need to map back to image pixels approximately
    # For visualization, just use the normalized x,y * image size
    points = []
    for i in range(33):
        x = (kps_33_4[i, 0] * 0.5 + 0.5) * w  # rough inverse of normalization
        y = (kps_33_4[i, 1] * 0.5 + 0.5) * h
        points.append((x, y))
        # Draw joint
        r = 4
        draw.ellipse([x-r, y-r, x+r, y+r], fill=(0, 200, 0))
        # Draw index
        draw.text((x+5, y-5), str(i), fill=(255, 0, 0))
    # Draw connections
    for a, b in POSE_CONNECTIONS:
        if a < len(points) and b < len(points):
            draw.line([points[a], points[b]], fill=(0, 100, 255), width=2)
    im.save(out_path)

def check_periodicity(angles):
    """Return True if angle sequence shows clear periodicity."""
    if len(angles) < 10:
        return False
    smooth = gaussian_filter1d(angles, sigma=1.0)
    N = len(smooth)
    yf = fft(smooth)
    power = np.abs(yf[:N//2])
    if len(power) > 2:
        max_power = np.max(power[1:])  # exclude DC
        total_power = np.sum(power[1:])
        if total_power > 0 and max_power > 0.2 * total_power:
            return True
    return False

def main():
    out_dir = Path("reports/skeleton_check")
    out_dir.mkdir(parents=True, exist_ok=True)

    # Load exercise_ml_map
    ml_map = json.load(open("data/exercise_ml_map.json"))

    # Target exercises (one per pattern)
    targets = {
        'squat': '01qpYSe',
        'horizontal_push': '0br45wL',
        'curl': '0IgNjSM',
        'lateral_raise': '53Ttlck',
        'lunge': '13VW2VO',
        'core_isometric': '1IG6gVF',
    }

    gif_dir = Path("data/raw/gifs")

    # 1. Skeleton visualization: 4 frames each
    print("=== SKELETON VISUALIZATION ===")
    for pattern, ex_id in targets.items():
        gif_path = gif_dir / f"{ex_id}.gif"
        if not gif_path.exists():
            print(f"  {pattern} ({ex_id}): GIF not found")
            continue
        frames = load_gif_frames(gif_path)
        if not frames:
            continue
        # Pick 4 evenly spaced frames
        n = min(4, len(frames))
        indices = np.linspace(0, len(frames) - 1, num=n).astype(int)
        for idx in indices:
            frame = frames[idx]
            padded = pad_image(frame)
            kps = extract_keypoints_from_frame(padded)
            if kps is not None:
                out_name = f"{pattern}_{ex_id}_frame{idx}.png"
                draw_skeleton(frame.copy(), kps, out_dir / out_name)
                print(f"  Saved: {out_name}")
            else:
                print(f"  No pose detected: {pattern} frame {idx}")

    # 2. Primary joint angle vs time for each pattern
    print("\n=== JOINT ANGLE PLOTS ===")
    for pattern, ex_id in targets.items():
        gif_path = gif_dir / f"{ex_id}.gif"
        if not gif_path.exists():
            continue
        frames = load_gif_frames(gif_path)
        if not frames:
            continue
        joint_name, joint_idx = PATTERN_PRIMARY_JOINTS[pattern]
        angles = []
        timestamps = []
        for i, frame in enumerate(frames):
            padded = pad_image(frame)
            kps = extract_keypoints_from_frame(padded)
            if kps is not None:
                a, b, c = kps[joint_idx[0]], kps[joint_idx[1]], kps[joint_idx[2]]
                angle = compute_angle(a[:3], b[:3], c[:3])
                angles.append(angle)
                timestamps.append(i / len(frames))  # normalized time
        if angles:
            plt.figure(figsize=(8, 4))
            plt.plot(timestamps, angles, 'b-o', markersize=3)
            plt.xlabel('Normalized Time')
            plt.ylabel('Angle (degrees)')
            plt.title(f'{pattern} ({ex_id}) - {joint_name} angle')
            plt.grid(True, alpha=0.3)
            plt.tight_layout()
            plot_path = out_dir / f"{pattern}_{ex_id}_angle.png"
            plt.savefig(plot_path, dpi=150)
            plt.close()
            print(f"  Saved angle plot: {plot_path}")
            # Detect cycles via autocorrelation
            if len(angles) > 10:
                smooth = gaussian_filter1d(angles, sigma=1.0)
                peaks, _ = find_peaks(-np.array(smooth), distance=5)
                print(f"    Detected {len(peaks)} peaks (reps)")
                # FFT
                N = len(smooth)
                yf = fft(smooth)
                xf = fftfreq(N, 1.0/len(frames))
                peak_idx = np.argmax(np.abs(yf[:N//2]))
                freq = xf[peak_idx]
                print(f"    Dominant frequency: {freq:.2f} cycles/sequence")

    # 3. Periodicity check on a SAMPLE of clips (not all 1324)
    print("\n=== PERIODICITY CHECK (sample of 100 clips) ===")
    manifest = json.load(open("data/manifests/combined_manifest.json"))
    # Filter to patterns we care about and sample
    sample_entries = []
    for entry in manifest:
        pattern = entry['pattern']
        if pattern in PATTERN_PRIMARY_JOINTS:
            sample_entries.append(entry)
    # Sample up to 100
    np.random.seed(42)
    if len(sample_entries) > 100:
        sample_entries = np.random.choice(sample_entries, 100, replace=False).tolist()
    
    periodic_count = 0
    total_checked = 0
    for entry in sample_entries:
        ex_id = entry['exercise_id']
        pattern = entry['pattern']
        gif_path = gif_dir / f"{ex_id}.gif"
        if not gif_path.exists():
            continue
        frames = load_gif_frames(gif_path)
        if len(frames) < 10:
            continue
        joint_name, joint_idx = PATTERN_PRIMARY_JOINTS[pattern]
        angles = []
        for frame in frames:
            padded = pad_image(frame)
            kps = extract_keypoints_from_frame(padded)
            if kps is not None:
                a, b, c = kps[joint_idx[0]], kps[joint_idx[1]], kps[joint_idx[2]]
                angles.append(compute_angle(a[:3], b[:3], c[:3]))
        if len(angles) >= 10:
            total_checked += 1
            if check_periodicity(angles):
                periodic_count += 1
    if total_checked > 0:
        print(f"Periodic fraction: {periodic_count}/{total_checked} = {100*periodic_count/total_checked:.1f}%")
    else:
        print("No clips with sufficient frames for periodicity check")

    print("\n=== SUMMARY ===")
    print(f"Output directory: {out_dir}")
    print("Review skeleton images and angle plots manually to verify quality.")

if __name__ == "__main__":
    main()