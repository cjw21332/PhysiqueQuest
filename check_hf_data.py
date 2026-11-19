from pathlib import Path
import json
import os

# Check the raw JSON metadata for HF dataset
reports_dir = Path(r"C:\Users\MY PC\Desktop\Projects\PhysiqueQuest\ml\reports\repcount")

# Look for metadata files
for file in reports_dir.glob("*.json"):
    print(f"Found JSON file: {file.name}")
    if "train" in file.name.lower():
        try:
            with open(file) as f:
                data = json.load(f)
                print(f"  Keys: {list(data.keys()) if isinstance(data, dict) else 'not a dict'}")
                if isinstance(data, dict) and 'videos' in data:
                    print(f"  Number of videos: {len(data['videos'])}")
                    first_video = data['videos'][0]
                    print(f"  First video keys: {list(first_video.keys()) if isinstance(first_video, dict) else 'not a dict'}")
        except Exception as e:
            print(f"  Error reading: {e}")

# Also check if there are any text files with video metadata
txt_files = list(reports_dir.glob("*.txt"))
print(f"\nFound {len(txt_files)} txt files")