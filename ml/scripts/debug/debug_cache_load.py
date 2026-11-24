import numpy as np
import os

# Test loading a specific cache file
cache_file = r"C:\Users\MY PC\Desktop\Projects\PhysiqueQuest\ml\data\keypoints_repcount\test_train143.npz"

print(f"Checking cache file: {cache_file}")
print(f"Exists: {os.path.exists(cache_file)}")

if os.path.exists(cache_file):
    try:
        print("Attempting to load...")
        data = np.load(cache_file, allow_pickle=True)
        print(f"Successfully loaded! Keys: {list(data.keys())}")
        print(f"Landmarks shape: {data['landmarks'].shape}")
        print(f"Timestamps shape: {data['timestamps_ms'].shape}")
    except Exception as e:
        print(f"Error loading cache file: {e}")
        import traceback
        traceback.print_exc()
else:
    print("Cache file does not exist!")