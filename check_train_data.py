import csv
from pathlib import Path

# Check train rows
OUT = Path(r"C:\Users\MY PC\Desktop\Projects\PhysiqueQuest\ml\reports\repcount")
with open(OUT / 'test_manifest.csv', newline='') as f:
    reader = csv.DictReader(f)
    train_rows = [row for row in reader if row['video_id'].startswith('train')]
    print(f"Total train rows: {len(train_rows)}")
    print(f"First train row: {train_rows[0]}")
    print(f"Count values: {[row['count'] for row in train_rows]}")
    
    # Try to extract keypoints
    from pathlib import Path
    CACHE = Path(r"C:\Users\MY PC\Desktop\Projects\PhysiqueQuest\ml\data\keypoints_repcount")
    RAW = Path(r"C:\Users\MY PC\Desktop\Projects\PhysiqueQuest\ml\data\raw")
    
    for row in train_rows:
        vid = row['video_id']
        print(f"\nProcessing {vid}:")
        
        # Try direct match
        cache_candidate = CACHE / f"{vid}.npz"
        print(f"  Direct match ({vid}.npz): exists={cache_candidate.exists()}")
        
        # Try test_train prefix
        test_candidate = CACHE / f"test_train{vid[5:]}.npz"
        print(f"  Test match (test_train{vid[5:]}.npz): exists={test_candidate.exists()}")
        
        # Check video file
        video_candidate = RAW / f"repcount/test_{vid}.mp4"
        print(f"  Video candidate (repcount/test_{vid}.mp4): exists={video_candidate.exists()}")