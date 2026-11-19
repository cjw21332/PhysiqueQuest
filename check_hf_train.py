import lance
try:
    ds = lance.dataset('hf://datasets/lmms-lab-eval/repcounta-lance/data/train.lance')
    meta = ds.to_table(columns=['video_id', 'source_name', 'action_type', 'count', 'cycle_bounds_json']).to_pylist()
    print(f'Loaded {len(meta)} videos from HF train dataset')
    train_vids = [row['video_id'] for row in meta]
    # Check how many start with 'train'
    train_prefix = [v for v in train_vids if v.startswith('train')]
    print(f'Videos with "train" prefix: {len(train_prefix)}')
    print(f'First 20: {train_prefix[:20]}')
    
    # Check against cache files
    import os
    cache_files = set(f for f in os.listdir(r"C:\Users\MY PC\Desktop\Projects\PhysiqueQuest\ml\data\keypoints_repcount") if f.startswith('test_train'))
    print(f'Cache files (test_train*): {len(cache_files)}')
    cache_vids = {f.replace('test_train', '').replace('.npz', '') for f in cache_files}
    print(f'Cache video IDs: {sorted(cache_vids)}')
    
    # Check intersection
    matches = [v for v in train_vids if v in cache_vids]
    print(f'Matches in HF train: {len(matches)} - {matches}')
    
    # Check test manifest train videos
    import csv
    with open(r'C:\Users\MY PC\Desktop\Projects\PhysiqueQuest\ml\reports\repcount\test_manifest.csv', newline='') as f:
        reader = csv.DictReader(f)
        test_manifest_train = [row['video_id'] for row in reader if row['video_id'].startswith('train')]
    print(f'Test manifest train videos: {test_manifest_train}')
    
except Exception as e:
    print(f'Error: {e}')