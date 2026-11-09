#!/usr/bin/env python3
"""Resumable download of ExerciseDB GIFs."""
import asyncio
import aiohttp
import json
import os
import re
import hashlib
import time
from pathlib import Path
from tqdm import tqdm

# Load catalog
catalog_path = Path(__file__).parent.parent / "data" / "exercisedb_catalog.json"
with open(catalog_path) as f:
    catalog = json.load(f)

gif_dir = Path(__file__).parent.parent / "data" / "raw" / "gifs"
gif_dir.mkdir(parents=True, exist_ok=True)

# Track already-downloaded files (resumable)
downloaded_names = set()
for f in gif_dir.iterdir():
    if f.is_file() and f.suffix.lower() == '.gif' and f.stat().st_size > 0:
        downloaded_names.add(f.stem)

# Also check manifest for resume state
manifest_path = Path(__file__).parent.parent / "reports" / "gif_download_manifest.json"
resume_state = {}
if manifest_path.exists():
    with open(manifest_path) as f:
        manifest_data = json.load(f)
    for item in manifest_data:
        if item.get("status") == "complete":
            downloaded_names.add(item["exerciseId"])

print(f"Already downloaded: {len(downloaded_names)} GIFs")

# Filter to ones not yet downloaded
ungotten = [ex for ex in catalog if ex["exerciseId"] not in downloaded_names]
print(f"To download: {len(ungotten)} / {len(catalog)}")

# Rate-limited semaphore
semaphore = asyncio.Semaphore(3)  # 3 concurrent requests max


async def download_one(session, exercise):
    """Download a single exercise GIF with resume support."""
    exercise_id = exercise["exerciseId"]
    name = exercise["name"]
    gif_url = exercise["gifUrl"]

    async with semaphore:
        try:
            # Compute file path - use exerciseId as primary key
            file_path = gif_dir / f"{exercise_id}.gif"

            async with session.get(gif_url, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                if resp.status == 404:
                    status = "404"
                    data = b""
                elif resp.status == 429:
                    await asyncio.sleep(2)
                    async with session.get(gif_url, timeout=aiohttp.ClientTimeout(total=30)) as resp2:
                        if resp2.status == 200:
                            data = await resp2.read()
                            status = "resumed"
                        else:
                            data = b""
                            status = f"error {resp2.status}"
                elif resp.status != 200:
                    status = f"error {resp.status}"
                    data = b""
                else:
                    data = await resp.read()
                    status = "complete"

            file_size = len(data)
            sha256 = hashlib.sha256(data).hexdigest() if data else "n/a"

            # Write file
            # Check if file already has same content (resume support)
            if file_path.exists() and file_path.stat().st_size == file_size and file_size > 0:
                # Verify hash
                with open(file_path, 'rb') as f:
                    existing_hash = hashlib.sha256(f.read()).hexdigest()
                if existing_hash == sha256 and existing_hash != "n/a":
                    status = "skipped (same)"
                else:
                    # Overwrite with new data
                    with open(file_path, 'wb') as f:
                        f.write(data)
            elif not file_path.exists() or file_size == 0:
                with open(file_path, 'wb') as f:
                    f.write(data)

            result = {
                "exerciseId": exercise_id,
                "name": name,
                "url": gif_url,
                "status": status,
                "sha256": sha256,
                "size": file_size
            }
            return result

        except Exception as e:
            return {
                "exerciseId": exercise_id,
                "name": name,
                "url": gif_url,
                "status": f"error: {str(e)[:50]}",
                "sha256": "n/a",
                "size": 0
            }


async def main():
    async with aiohttp.ClientSession() as session:
        tasks = []
        for exercise in ungotten:
            tasks.append(download_one(session, exercise))

        # Process with progress bar
        results = []
        for coro in tqdm(asyncio.as_completed(tasks), total=len(tasks),
                         desc="Downloading GIFs"):
            result = await coro
            results.append(result)

        # Save manifest
        manifest_path = Path(__file__).parent.parent / "reports" / "gif_download_manifest.json"
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        with open(manifest_path, 'w') as f:
            json.dump(results, f, indent=2)

        # Summary
        status_counts = {}
        for r in results:
            s = r["status"]
            status_counts[s] = status_counts.get(s, 0) + 1

        print(f"\nDownload summary:")
        for status, count in sorted(status_counts.items()):
            print(f"  {status}: {count}")
        print(f"Total: {len(results)} GIFs processed")


if __name__ == "__main__":
    asyncio.run(main())