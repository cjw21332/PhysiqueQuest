import numpy as np
cache_file = r"C:\Users\MY PC\Desktop\Projects\PhysiqueQuest\ml\data\keypoints_repcount\test_train143.npz"
data = np.load(cache_file, allow_pickle=True)
landmarks = data['landmarks']
timestamps_ms = data['timestamps_ms']
aspect = data['source_width'] / data['source_height']
print(f'landmarks shape: {landmarks.shape}')
print(f'timestamps_ms shape: {timestamps_ms.shape}')
print(f'aspect: {aspect}')
print(f'source_width: {data["source_width"]}, source_height: {data["source_height"]}')
print(f'landmarks[0]: {landmarks[0]}')