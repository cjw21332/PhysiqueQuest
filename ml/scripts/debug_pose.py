"""
Standalone MediaPipe pose debug script for PhysiqueQuest.

Purpose: find out WHY pose detection returns 0% on the ExerciseDB GIFs.
Run it with the project's venv, from anywhere:

  ml\.venv\Scripts\python debug_pose.py ^
      --model ml\models\pose_landmarker_lite.task ^
      --gifs  ml\data\raw\gifs ^
      --control path\to\photo_of_a_person.jpg

Optional: pass several models to compare, e.g. --model lite.task full.task heavy.task
Outputs a table plus debug PNGs in ./debug_out/
"""
import argparse
import glob
import hashlib
import os
import sys
import traceback

import numpy as np
from PIL import Image, ImageSequence

import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def make_landmarker(model_path, conf):
    opts = vision.PoseLandmarkerOptions(
        base_options=mp_python.BaseOptions(model_asset_path=model_path),
        running_mode=vision.RunningMode.IMAGE,
        num_poses=1,
        min_pose_detection_confidence=conf,
        min_pose_presence_confidence=conf,
        min_tracking_confidence=conf,
    )
    return vision.PoseLandmarker.create_from_options(opts)


def detect(lm, pil_rgb):
    arr = np.ascontiguousarray(np.asarray(pil_rgb.convert("RGB"), dtype=np.uint8))
    img = mp.Image(image_format=mp.ImageFormat.SRGB, data=arr)
    res = lm.detect(img)
    return len(res.pose_landmarks) > 0


def load_gif_frames(path, n=6):
    """Composite onto white (handles transparency), return up to n evenly spaced RGB frames."""
    frames = []
    with Image.open(path) as gif:
        for f in ImageSequence.Iterator(gif):
            rgba = f.convert("RGBA")
            bg = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
            frames.append(Image.alpha_composite(bg, rgba).convert("RGB"))
    if not frames:
        return []
    idx = np.linspace(0, len(frames) - 1, num=min(n, len(frames))).astype(int)
    return [frames[i] for i in idx]


def pad(im, factor=1.5):
    w, h = im.size
    canvas = Image.new("RGB", (int(w * factor), int(h * factor)), im.getpixel((0, 0)))
    canvas.paste(im, (int(w * (factor - 1) / 2), int(h * (factor - 1) / 2)))
    return canvas


def variants(im):
    up = im.resize((im.width * 3, im.height * 3), Image.LANCZOS)
    return {
        "native": im,
        "up3x": up,
        "pad": pad(im),
        "up3x+pad": pad(up),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", nargs="+", required=True)
    ap.add_argument("--gifs", required=True)
    ap.add_argument("--control", help="path to any photo of a person (full body ideal)")
    ap.add_argument("--n-gifs", type=int, default=20)
    args = ap.parse_args()

    os.makedirs("debug_out", exist_ok=True)
    print("python", sys.version.split()[0], "| mediapipe", getattr(mp, "__version__", "?"))

    gif_paths = sorted(glob.glob(os.path.join(args.gifs, "*.gif")))
    print(f"found {len(gif_paths)} gifs in {args.gifs}")
    if not gif_paths:
        sys.exit("no gifs found, check --gifs path")
    step = max(1, len(gif_paths) // args.n_gifs)
    sample = gif_paths[::step][: args.n_gifs]

    for model in args.model:
        print("\n" + "=" * 70)
        print("MODEL:", model)
        print("  size bytes:", os.path.getsize(model))
        print("  sha256    :", sha256(model))
        with open(model, "rb") as f:
            head = f.read(16)
        print("  first bytes:", head, "(should NOT look like '<html' or '<!DOC')")

        for conf in (0.5, 0.3):
            print(f"\n--- min confidence {conf} ---")
            try:
                lm = make_landmarker(model, conf)
            except Exception:
                print("FAILED to create landmarker:")
                traceback.print_exc()
                continue

            # 1) control photo
            if args.control:
                try:
                    ok = detect(lm, Image.open(args.control))
                    print(f"CONTROL photo detected pose: {ok}")
                except Exception:
                    print("control detection raised:")
                    traceback.print_exc()

            # 2) gif variants
            totals = {k: [0, 0] for k in ("native", "up3x", "pad", "up3x+pad")}
            errors = 0
            for gi, gp in enumerate(sample):
                try:
                    frames = load_gif_frames(gp)
                except Exception:
                    errors += 1
                    traceback.print_exc()
                    continue
                if gi == 0 and conf == 0.5:
                    frames[0].save(os.path.join("debug_out", "gif0_frame0.png"))
                    print(f"  first gif: {os.path.basename(gp)} size={frames[0].size} frames sampled={len(frames)}")
                for fr in frames:
                    for name, im in variants(fr).items():
                        try:
                            totals[name][1] += 1
                            if detect(lm, im):
                                totals[name][0] += 1
                        except Exception:
                            errors += 1
                            if errors <= 3:
                                traceback.print_exc()
            print(f"{'variant':<10} detected/total   rate")
            for name, (d, t) in totals.items():
                rate = (100.0 * d / t) if t else 0.0
                print(f"{name:<10} {d:>5}/{t:<8} {rate:5.1f}%")
            print("errors:", errors)
            lm.close()

    print("\nDone. Look at debug_out/gif0_frame0.png to confirm the frame really shows a person.")


if __name__ == "__main__":
    main()