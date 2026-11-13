"""Test keypoint extraction with synthetic video - simplified"""
import numpy as np
import cv2
import tempfile
import os
import sys
from pathlib import Path

# Add ml/scripts to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "ml" / "scripts"))
from scripts.extract_pose import process_video_gif

# Create a synthetic test video with a simple stick figure
fourcc = cv2.VideoWriter_fourcc(*'mp4v')
tmpfile = tempfile.mktemp(suffix='.mp4')
h, w = 480, 640
out = cv2.VideoWriter(tmpfile, fourcc, 15, (w, h))

# Create a few frames with a pose-like stick figure
for i in range(45):  # 3 seconds at 15 FPS
    frame = np.zeros((h, w, 3), dtype=np.uint8)
    # Draw simple stick figure
    cx, cy = w//2, h//2
    # Hip shoulders
    cv2.line(frame, (cx-80, cy+40), (cx+80, cy+40), (255, 255, 255), 2)
    # Knees
    cv2.line(frame, (cx-60, cy+100), (cx-40, cy+100), (255, 255, 255), 2)
    cv2.line(frame, (cx+60, cy+100), (cx+40, cy+100), (255, 255, 255), 2)
    # Ankles
    cv2.line(frame, (cx-60, cy+160), (cx-40, cy+160), (255, 255, 255), 2)
    cv2.line(frame, (cx+60, cy+160), (cx+40, cy+160), (255, 255, 255), 2)
    # Keep it static
    out.write(frame)

out.release()
print(f'Created synthetic test video: {tmpfile}')

# Now test extraction
result = process_video_gif(Path(tmpfile), label='test_squat', subject_id='test1')
print(f'Result: {result["num_clips"]} clips, {result["keypoint_count"]} keypoints')
print(f'Clips: {result["clips"]}')

# Cleanup
os.unlink(tmpfile)
print('Test complete')