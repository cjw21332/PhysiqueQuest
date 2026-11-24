from pathlib import Path
CACHE = Path(r"C:\Users\MY PC\Desktop\Projects\PhysiqueQuest\ml\data\keypoints_repcount")
vid = "train143"

# Test the logic
possible_prefixes = [
    ('train', '_'), ('test', '_'), ('validation', '_'),
    ('test_train', ''), ('validation_train', '')
]

cache_file = None
for prefix, sep in possible_prefixes:
    candidate = CACHE / f'{prefix}{sep}{vid}.npz'
    print(f"Trying {prefix}{sep}{vid}.npz -> exists: {candidate.exists()}")
    if candidate.exists():
        cache_file = candidate
        print(f"Found: {candidate}")
        break

print(f"Final cache_file: {cache_file}")