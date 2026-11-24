import numpy as np
cache_file = r"C:\Users\MY PC\Desktop\Projects\PhysiqueQuest\ml\data\keypoints_repcount\test_train3344.npz"
data = np.load(cache_file, allow_pickle=True)
print("Keys:", list(data.files))
print(f"source_width: {data['source_width']}")
print(f"source_height: {data['source_height']}")
print(f"fps: {data['fps']}")
print(f"landmarks shape: {data['landmarks'].shape}")
print(f"timestamps_ms shape: {data['timestamps_ms'].shape}")
print(f"landmarks[0]: {data['landmarks'][0]}")
print(f"detection_mask[:5]: {data['detection_mask'][:5]}")