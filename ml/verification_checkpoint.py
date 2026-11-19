import os, json
from pathlib import Path

# 1. Synthetic data documentation - what was used for training
print('=== SYNTHETIC DATA DOCUMENTATION ===')
print('Dataset class: KeypointSequenceDataset')
print('Source: ml/src/pq_ml/dataset.py _create_dummy_sequence()')
print()
print('Window construction:')
print('  - GIFs too short (median 12 frames) for 48-frame windows')
print('  - Training uses SYNTHETIC keypoints generated per-class')
print('  - _create_dummy_sequence() creates sinusoidal joint motions')
print('  - Each class gets a fixed pattern (e.g., squat = knee oscillation)')
print('  - NO real GIF keypoints used for training windows')
print('  - All 1059 train groups produce identical synthetic patterns per class')
print()

# 2. Angle configs source breakdown
print('=== ANGLE CONFIG SOURCES ===')
with open('models/generated_angle_configs.json') as f:
    configs = json.load(f)
print('Total configs:', len(configs))
print('All are rule-based defaults (no GIF-derived angles)')
print('source field needs to be added: "rule"')

# 3. Task 2 periodicity result
print()
print('=== TASK 2 PERIODICITY ===')
print('Sample of 87 GIF clips (all with >=10 frames): 87/87 = 100% periodic')
print('BUT: GIFs only ~12 frames (0.8s), 1-2 rep cycles visible')
print('Skeleton_check images: 24 frames saved (4 per exercise x 6 exercises)')
print('Visual verdict: Skeletons align on body; angle curves show 1-2 clean cycles')
print('Limitation: Too few frames for robust periodicity assessment')

# 4. PushUpBench
print()
print('=== PUSHUPBENCH ===')
print('License: CC-BY-4.0 (tags: license:cc-by-4.0)')
print('Size: 231 MP4 videos, ~500MB')
print('Extracted so far: 34 videos downloaded, 65 clips (48-frame windows)')
print('Detection rate: ~95% frames with pose (similar to GIFs)')
print('Status: Download in progress; NOT yet used in training')
print('Real-world test set: Hold out all PushUpBench for final evaluation')

# 5. Real video smoke test result
print()
print('=== SMOKE TEST ON REAL VIDEO ===')
print('Video: c-curl twist (expected: core_flexion/curl)')
print('Prediction: cardio_dynamic (conf=0.23) - WRONG, low confidence')
print('Reason: Model trained on synthetic data, does not generalize to real video')
print('Other real videos: Not tested yet (extraction slow)')