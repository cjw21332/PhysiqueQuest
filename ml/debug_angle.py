import numpy as np
from scipy.ndimage import gaussian_filter1d
from scipy.signal import find_peaks

data = np.load('data/keypoints_full/01e83deb_0015_c-curl twist_[13].npz')
kps = data['keypoints']

joints = [11, 13, 15]
angles = []
for t in range(kps.shape[0]):
    a, b, c = kps[t, joints[0], :3], kps[t, joints[1], :3], kps[t, joints[2], :3]
    ba = a - b; bc = c - b
    cosine = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-8)
    angle = np.degrees(np.arccos(np.clip(cosine, -1, 1)))
    angles.append(angle)
angles = np.array(angles)
smooth = gaussian_filter1d(angles, sigma=2.0)

peaks, _ = find_peaks(smooth, prominence=5, distance=10)
valleys, _ = find_peaks(-smooth, prominence=5, distance=10)

print(f"Peaks: {len(peaks)}, Valleys: {len(valleys)}")
if len(peaks) > 0 and len(valleys) > 0:
    peak_angles = smooth[peaks]
    valley_angles = smooth[valleys]
    print(f"Peak angles: mean={np.mean(peak_angles):.1f}, range=[{np.min(peak_angles):.1f}, {np.max(peak_angles):.1f}]")
    print(f"Valley angles: mean={np.mean(valley_angles):.1f}, range=[{np.min(valley_angles):.1f}, {np.max(valley_angles):.1f}]")
    print(f"Expected ROM: {np.mean(peak_angles) - np.mean(valley_angles):.1f}")
    print(f"Rep count from valleys: {len(valleys)}")
    print(f"Rep count from peaks: {len(peaks)}")