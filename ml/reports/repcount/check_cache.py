import numpy as np

data = np.load(r'C:\Users\MY PC\Desktop\Projects\PhysiqueQuest\ml\data\keypoints_repcount\test_stu2_39.npz')
print(f'landmarks shape: {data["landmarks"].shape}')
print(f'Keys: {data.files}')