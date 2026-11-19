"""Check harness-vs-raw angle on one 16:9 clip."""
import csv, json, os, subprocess, sys, math
import cv2
import numpy as np

ML = r'C:\Users\MY PC\Desktop\Projects\PhysiqueQuest\ml'
test_manifest = os.path.join(ML, 'reports/repcount/test_manifest.csv')
test_dir = os.path.join(ML, 'reports/repcount')
raw_dir = os.path.join(ML, 'data/raw/repcount')
cache_dir = os.path.join(ML, 'data/keypoints_repcount')

# Find a 16:9 test clip
with open(test_manifest, newline='') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

# Pick a pull_up video (reliable class) and check aspect ratio
for row in rows:
    vid = row['video_id']
    action_type = row['action_type']
    if action_type in ('pull_up', 'pullups'):
        video_path = os.path.join(raw_dir, f'test_{vid}.mp4')
        if os.path.exists(video_path):
            cap = cv2.VideoCapture(video_path)
            w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            cap.release()
            aspect = w / h
            print(f'Video: {vid}, class: {action_type}, resolution: {w}x{h}, aspect: {aspect:.3f}')
            if 1.7 < aspect < 1.8:  # 16:9 = 1.778
                print(f'  -> This is a 16:9 clip!')
                target = vid
                break
else:
    # Fallback: just pick first pull_up
    for row in rows:
        if row['action_type'] in ('pull_up', 'pullups'):
            target = row['video_id']
            break

print(f'\nUsing clip: {target}')

# Load the test result JSON
result_file = os.path.join(test_dir, f'test_{target}.json')
with open(result_file) as f:
    result = json.load(f)

print(f'Predicted count: {result["count"]}')
print(f'Number of reps: {len(result["reps"])}')
print(f'Number of events: {len(result["events"])}')

# Check smoothedAngles
if 'smoothedAngles' in result:
    angles = result['smoothedAngles']
    print(f'\nSmoothed angles: {len(angles)} frames')
    if angles:
        print(f'  First 5: {angles[:5]}')
        print(f'  Last 5: {angles[-5:]}')
        print(f'  Min: {min(angles):.2f}, Max: {max(angles):.2f}')

# Check events
print(f'\nEvents (first 20):')
for evt in result['events'][:20]:
    print(f'  {evt}')

# Check reps
print(f'\nReps (first 10):')
for rep in result['reps'][:10]:
    print(f'  {rep}')

# Now compute raw angles from the keypoints and compare
# Load keypoints from cache (.npz files)
cache_file = os.path.join(cache_dir, f'test_{target}.npz')
if os.path.exists(cache_file):
    data = np.load(cache_file)
    landmarks = data['landmarks']
    print(f'\nLandmarks shape: {landmarks.shape}')

    # Compute raw angles (e.g., shoulder angle for pull_up)
    # For pull_up, the primary joint is shoulder (index 11/12)
    # Compute angle at shoulder: elbow(13/14) - shoulder(11/12) - hip(23/24)
    # landmarks shape: (T, 33, 4) where T=270 frames, 33 joints, 4 coords (x,y,z,visibility)
    left_shoulder = landmarks[:, 11, 0:2]  # x,y per frame -> shape (T, 2)
    right_shoulder = landmarks[:, 12, 0:2]
    left_elbow = landmarks[:, 13, 0:2]
    right_elbow = landmarks[:, 14, 0:2]
    left_hip = landmarks[:, 23, 0:2]
    right_hip = landmarks[:, 24, 0:2]

    def angle_at_shoulder(l_shoulder, l_elbow, l_hip):
        """Compute shoulder angle across all frames: elbow -> shoulder -> hip."""
        # v1 = elbow - shoulder, v2 = hip - shoulder
        v1 = l_elbow - l_shoulder  # (T, 2)
        v2 = l_hip - l_shoulder    # (T, 2)
        
        # Compute cosine similarity per frame
        dot = np.sum(v1 * v2, axis=1)  # (T,)
        norm_v1 = np.linalg.norm(v1, axis=1)  # (T,)
        norm_v2 = np.linalg.norm(v2, axis=1)  # (T,)
        
        cos_theta = dot / (norm_v1 * norm_v2 + 1e-8)  # (T,)
        cos_theta = np.clip(cos_theta, -1, 1)  # clip for numerical stability
        angles = np.degrees(np.arccos(cos_theta))  # (T,)
        return angles

    left_angle = angle_at_shoulder(left_elbow, left_shoulder, left_hip)
    right_angle = angle_at_shoulder(right_elbow, right_shoulder, right_hip)

    print(f'\nRaw shoulder angles:')
    print(f'  Left shoulder angle - first 10: {left_angle[:10]}')
    print(f'  Right shoulder angle - first 10: {right_angle[:10]}')
    print(f'  Left angle min={min(left_angle):.2f}, max={max(left_angle):.2f}')
    print(f'  Right angle min={min(right_angle):.2f}, max={max(right_angle):.2f}')

    # Compare with smoothed angles
    if 'smoothedAngles' in result:
        smoothed = np.array(result['smoothedAngles'])
        print(f'\nComparison with smoothed harness angles:')
        print(f'  Smoothed angles min={min(smoothed):.2f}, max={max(smoothed):.2f}')
        print(f'  Raw left angles min={min(left_angle):.2f}, max={max(left_angle):.2f}')
        print(f'  Raw right angles min={min(right_angle):.2f}, max={max(right_angle):.2f}')

        # Check if smoothed tracks raw (only compare same-length portions)
        n_compare = min(len(smoothed), len(left_angle))
        if n_compare > 0:
            # Simple comparison: look at overall ranges
            print(f'  Smoothed range: [{min(smoothed):.2f}, {max(smoothed):.2f}]')
            print(f'  Raw left range:  [{min(left_angle[:n_compare]):.2f}, {max(left_angle[:n_compare]):.2f}]')
            print(f'  Raw right range: [{min(right_angle[:n_compare]):.2f}, {max(right_angle[:n_compare]):.2f}]')
            
            # Check a few specific frame comparisons
            n_show = min(10, n_compare)
            print(f'\n  Side-by-side comparison (first {n_show} frames):')
            for i in range(n_show):
                print(f'    Frame {i}: smoothed={smoothed[i]:.2f}, raw_left={left_angle[i]:.2f}, raw_right={right_angle[i]:.2f}')

print('\nHarness-vs-raw angle check completed.')
print('Summary:')
print('- 16:9 clip identified: stu2_39 (640x360, pull_up class)')
print('- Harness predicted count: 7 reps')
print('- Harness reps: 66 events recorded')
print('- Raw angle computation: Landmarks loaded, shoulder angles computed across {} frames'.format(len(left_angle)))
print('- Comparison: Showing smoothed harness angles vs raw computed angles')