#!/usr/bin/env python3
import numpy as np
import json
import os
from pathlib import Path

reports_dir = Path(r"C:\Users\MY PC\Desktop\Projects\PhysiqueQuest\ml\reports\repcount")

if (reports_dir / "train_manifest.json").exists():
    print("Found train_manifest.json")
    with open(reports_dir / "train_manifest.json") as f:
        train_manifest = json.load(f)
    print(f"Train manifest has {len(train_manifest)} entries")
else:
    print("train_manifest.json not found")

parquet_dir = reports_dir / "parquet"
if parquet_dir.exists():
    print(f"Parquet files in reports/repcount/parquet: {len(list(parquet_dir.glob('*.parquet')))} files")
    
    train_parquet = parquet_dir / "train.parquet"
    if train_parquet.exists():
        try:
            import pyarrow.parquet as pq
            table = pq.read_table(str(train_parquet))
            print(f"Train parquet has {table.num_rows} rows")
            video_ids = table.column('video_id').to_pylist() if 'video_id' in table.column_names else []
            print(f"First 10 video_ids: {video_ids[:10]}")
            train_count = sum(1 for vid in video_ids if isinstance(vid, str) and vid.startswith('train'))
            print(f"Videos starting with 'train': {train_count}")
        except Exception as e:
            print(f"Error reading train.parquet: {e}")
else:
    print("No parquet directory found")

if (reports_dir / "train_metadata.json").exists():
    print("Found train_metadata.json")
    with open(reports_dir / "train_metadata.json") as f:
        metadata = json.load(f)
    print(f"Train metadata keys: {metadata.keys() if isinstance(metadata, dict) else 'unknown'}")