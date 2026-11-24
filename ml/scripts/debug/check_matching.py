import lance
import os

ds = lance.dataset('hf://datasets/lmms-lab-eval/repcounta-lance/data/train.lance')
meta = ds.to_table(columns=['video_id', 'source_name', 'action_type', 'count']).to_pylist()
print(f'Loaded {len(meta)} videos from HF train dataset')

# Check video_id patterns
train_vids = [row['video_id'] for row in meta]
print(f'First 20 video_ids: {train_vids[:20]}')

# Check cache files
cache_dir = r"C:\Users\MY PC\Desktop\Projects\PhysiqueQuest\ml\data\keypoints_repcount"
cache_files = set(f for f in os.listdir(cache_dir))
print(f'\nTotal cache files: {len(cache_files)}')

# Try to match train143 -> test_train143.npz
for vid in train_vids[:5]:
    direct = f'{vid}.npz'
    test_train = f'test_train{vid[5:]}.npz' if vid.startswith('train') else None
    val_train = f'validation_train{vid[5:]}.npz' if vid.startswith('train') else None
    print(f'  {vid}: direct={direct in cache_files}, test_train={test_train in cache_files if test_train else "N/A"}, val_train={val_train in cache_files if val_train else "N/A"}')

# Count matches
matches = 0
for vid in train_vids:
    if vid.startswith('train'):
        test_train = f'test_train{vid[5:]}.npz'
        val_train = f'validation_train{vid[5:]}.npz'
        if test_train in cache_files or val_train in cache_files:
            matches += 1
    elif vid.startswith('test'):
        if f'test_{vid}.npz' in cache_files:
            matches += 1
    elif vid.startswith('validation') or vid.startswith('val'):
        if f'validation_{vid}.npz' in cache_files:
            matches += 1
    else:
        # stu* videos
        for prefix in ['train_', 'test_', 'validation_']:
            if f'{prefix}{vid}.npz' in cache_files:
                matches += 1
                break

print(f'\nTotal matches found: {matches}/{len(train_vids)}')

# Show some unmatched
unmatched = []
for vid in train_vids:
    found = False
    if vid.startswith('train'):
        test_train = f'test_train{vid[5:]}.npz'
        val_train = f'validation_train{vid[5:]}.npz'
        if test_train in cache_files or val_train in cache_files:
            found = True
    elif vid.startswith('test'):
        if f'test_{vid}.npz' in cache_files:
            found = True
    elif vid.startswith('validation') or vid.startswith('val'):
        if f'validation_{vid}.npz' in cache_files:
            found = True
    else:
        for prefix in ['train_', 'test_', 'validation_']:
            if f'{prefix}{vid}.npz' in cache_files:
                found = True
                break
    if not found:
        unmatched.append(vid)

print(f'Unmatched: {len(unmatched)}')
print(f'Sample unmatched: {unmatched[:10]}')