import csv
from pathlib import Path

# Check test_manifest.csv
test_manifest = Path(r"C:\Users\MY PC\Desktop\Projects\PhysiqueQuest\ml\reports\repcount\test_manifest.csv")
if test_manifest.exists():
    print(f"Found test_manifest.csv with {test_manifest.stat().st_size} bytes")
    with open(test_manifest) as f:
        reader = csv.DictReader(f)
        meta = list(reader)
    print(f"Total rows: {len(meta)}")
    none_count = sum(1 for row in meta if row.get('count') is None)
    print(f"Rows with None count: {none_count}")
    train_rows = [row for row in meta if row['video_id'].startswith('train')]
    print(f"Train rows: {len(train_rows)}")
    train_none = sum(1 for row in train_rows if row.get('count') is None)
    print(f"Train rows with None count: {train_none}")
else:
    print("test_manifest.csv not found")

# Check if any train rows have None count
OUT = Path(r"C:\Users\MY PC\Desktop\Projects\PhysiqueQuest\ml\reports\repcount")
with open(OUT / 'test_manifest.csv', newline='') as f:
    reader = csv.DictReader(f)
    for i, row in enumerate(reader):
        if row['video_id'].startswith('train') and row.get('count') is None:
            print(f"Row {i}: video_id={row['video_id']}, count={row.get('count')}")