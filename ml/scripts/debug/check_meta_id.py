import json
import csv
from pathlib import Path

# Mock paths for testing logic
ML = Path(r"C:\Users\MY PC\Desktop\Projects\PhysiqueQuest\ml")
OUT = ML / 'reports' / 'repcount'

# Simulate loading metadata
with open(OUT / 'test_manifest.csv', newline='') as f:
    reader = csv.DictReader(f)
    meta = [row for row in reader if row['video_id'].startswith('train')]

print(f"Loaded {len(meta)} train videos")
for i, row in enumerate(meta[:5]):
    print(f"Video {i}: {row['video_id']}")
