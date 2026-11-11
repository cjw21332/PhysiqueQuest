#!/usr/bin/env python3
"""T2: GIF timing analysis - read per-frame durations, build timestamps, resample."""
from pathlib import Path
from PIL import Image
import numpy as np
import json
import sys

GIF_DIR = Path("data/raw/gifs")
OUT_DIR = Path("reports/t2_gif_timing")
OUT_DIR.mkdir(parents=True, exist_ok=True)

def analyze_gif(gif_path):
    """Extract per-frame durations and compute statistics."""
    try:
        with Image.open(gif_path) as im:
            durations = []
            frames = 0
            try:
                while True:
                    dur = im.info.get("duration", 0)
                    durations.append(dur)
                    frames += 1
                    im.seek(im.tell() + 1)
            except EOFError:
                pass
            
            if not durations:
                return None
            
            # Convert to seconds
            durations_sec = [d / 1000.0 for d in durations]
            total_duration = sum(durations_sec)
            
            # Build timestamps
            timestamps = np.cumsum([0] + durations_sec[:-1])
            
            return {
                "file": gif_path.name,
                "num_frames": frames,
                "durations_ms": durations,
                "durations_sec": durations_sec,
                "total_duration_sec": total_duration,
                "mean_frame_duration_ms": float(np.mean(durations)),
                "std_frame_duration_ms": float(np.std(durations)),
                "min_frame_duration_ms": int(np.min(durations)),
                "max_frame_duration_ms": int(np.max(durations)),
                "timestamps": timestamps.tolist(),
                "effective_fps": frames / total_duration if total_duration > 0 else 0,
            }
    except Exception as e:
        return {"file": gif_path.name, "error": str(e)}

def main():
    gif_files = sorted(GIF_DIR.glob("*.gif"))
    print(f"Found {len(gif_files)} GIFs")
    
    all_results = []
    for i, gif_path in enumerate(gif_files):
        if i % 100 == 0:
            print(f"  Processing {i}/{len(gif_files)}...")
        result = analyze_gif(gif_path)
        if result:
            all_results.append(result)
    
    # Aggregate statistics
    valid = [r for r in all_results if "error" not in r]
    print(f"\nValid GIFs: {len(valid)}/{len(all_results)}")
    
    if valid:
        all_durations = []
        all_total_durs = []
        all_fps = []
        frame_counts = []
        
        for r in valid:
            all_durations.extend(r["durations_ms"])
            all_total_durs.append(r["total_duration_sec"])
            all_fps.append(r["effective_fps"])
            frame_counts.append(r["num_frames"])
        
        print(f"\n=== PER-FRAME DURATION STATISTICS ===")
        print(f"Total frames analyzed: {len(all_durations)}")
        print(f"Mean frame duration: {np.mean(all_durations):.1f} ms")
        print(f"Median frame duration: {np.median(all_durations):.1f} ms")
        print(f"Std frame duration: {np.std(all_durations):.1f} ms")
        print(f"Min frame duration: {np.min(all_durations):.0f} ms")
        print(f"Max frame duration: {np.max(all_durations):.0f} ms")
        
        # Percentiles
        for p in [10, 25, 50, 75, 90, 95, 99]:
            print(f"  P{p}: {np.percentile(all_durations, p):.1f} ms")
        
        print(f"\n=== GIF-LEVEL STATISTICS ===")
        print(f"Mean total duration: {np.mean(all_total_durs):.3f} sec")
        print(f"Median total duration: {np.median(all_total_durs):.3f} sec")
        print(f"Min total duration: {np.min(all_total_durs):.3f} sec")
        print(f"Max total duration: {np.max(all_total_durs):.3f} sec")
        
        print(f"\nMean frame count: {np.mean(frame_counts):.1f}")
        print(f"Median frame count: {np.median(frame_counts):.1f}")
        print(f"Min frame count: {np.min(frame_counts)}")
        print(f"Max frame count: {np.max(frame_counts)}")
        
        print(f"\nEffective FPS distribution:")
        for p in [10, 25, 50, 75, 90]:
            print(f"  P{p}: {np.percentile(all_fps, p):.1f} FPS")
        
        # Check how many differ materially from 0.8s (15 FPS * 12 frames = 0.8s)
        # 0.8s = 800ms total
        target_dur = 0.8
        diff_count = sum(1 for d in all_total_durs if abs(d - target_dur) > 0.1)
        print(f"\nGIFs with duration differing >0.1s from 0.8s: {diff_count}/{len(valid)} ({diff_count/len(valid)*100:.1f}%)")
        
        # Show some examples of different durations
        print(f"\nExample GIF durations:")
        for r in valid[:20]:
            print(f"  {r['file']}: {r['num_frames']} frames, {r['total_duration_sec']:.3f}s, {r['effective_fps']:.1f} FPS")
        
        # Save detailed results
        with open(OUT_DIR / "gif_timing_detailed.json", "w") as f:
            json.dump(all_results, f, indent=2)
        
        # Save summary
        summary = {
            "total_gifs": len(all_results),
            "valid_gifs": len(valid),
            "per_frame_stats": {
                "mean_ms": float(np.mean(all_durations)),
                "median_ms": float(np.median(all_durations)),
                "std_ms": float(np.std(all_durations)),
                "min_ms": int(np.min(all_durations)),
                "max_ms": int(np.max(all_durations)),
                "percentiles": {f"p{p}": float(np.percentile(all_durations, p)) for p in [10,25,50,75,90,95,99]},
            },
            "gif_level_stats": {
                "mean_total_duration_sec": float(np.mean(all_total_durs)),
                "median_total_duration_sec": float(np.median(all_total_durs)),
                "min_total_duration_sec": float(np.min(all_total_durs)),
                "max_total_duration_sec": float(np.max(all_total_durs)),
                "mean_frame_count": float(np.mean(frame_counts)),
                "median_frame_count": float(np.median(frame_counts)),
            },
            "fps_stats": {
                "mean_fps": float(np.mean(all_fps)),
                "median_fps": float(np.median(all_fps)),
                "percentiles": {f"p{p}": float(np.percentile(all_fps, p)) for p in [10,25,50,75,90]},
            },
            "diff_from_08s": diff_count,
        }
        with open(OUT_DIR / "gif_timing_summary.json", "w") as f:
            json.dump(summary, f, indent=2)
        
        print(f"\nResults saved to {OUT_DIR}")
    
    return all_results

if __name__ == "__main__":
    main()