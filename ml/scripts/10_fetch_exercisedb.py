#!/usr/bin/env python3
"""Fetch ExerciseDB catalog and save to ml/data/exercisedb_catalog.json"""
import asyncio
import aiohttp
import json
import time
from pathlib import Path
from tqdm import tqdm

BASE_URL = "https://oss.exercisedb.dev/api/v1"

async def fetch_all_exercises():
    """Fetch all exercises from ExerciseDB API with pagination"""
    exercises = []
    cursor = None
    page = 0
    
    async with aiohttp.ClientSession() as session:
        while True:
            params = {"limit": "100"}
            if cursor:
                params["after"] = cursor
            
            url = f"{BASE_URL}/exercises"
            try:
                async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                    if resp.status == 429:
                        # Rate limited, wait and retry
                        retry_after = resp.headers.get("retry-after", "5")
                        print(f"Rate limited, waiting {retry_after}s...")
                        await asyncio.sleep(int(retry_after))
                        continue
                    elif resp.status != 200:
                        print(f"Error {resp.status}: {await resp.text()}")
                        break
                    
                    data = await resp.json()
                    if not data.get("success") or not data.get("data"):
                        break
                    
                    page_data = data["data"]
                    exercises.extend(page_data)
                    page += 1
                    print(f"Page {page}: fetched {len(page_data)} exercises, total: {len(exercises)}")
                    
                    meta = data.get("meta", {})
                    if not meta.get("hasNextPage") or not meta.get("nextCursor"):
                        break
                    cursor = meta["nextCursor"]
                    
                    # Polite delay
                    await asyncio.sleep(1.2)
                    
            except asyncio.TimeoutError:
                print("Timeout, retrying...")
                await asyncio.sleep(5)
                continue
            except Exception as e:
                print(f"Error: {e}")
                await asyncio.sleep(5)
                continue
    
    return exercises

async def main():
    print("Fetching ExerciseDB catalog...")
    exercises = await fetch_all_exercises()
    print(f"Total exercises fetched: {len(exercises)}")
    
    # Save to JSON
    output_path = Path(__file__).parent.parent / "data" / "exercisedb_catalog.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, "w") as f:
        json.dump(exercises, f, indent=2)
    
    print(f"Saved to {output_path}")
    
    # Print summary
    if exercises:
        sample = exercises[0]
        print(f"\nSample exercise fields: {list(sample.keys())}")
        print(f"Sample: {json.dumps(sample, indent=2)[:500]}...")
        
        # Count distinct values
        equipments = set()
        body_parts = set()
        target_muscles = set()
        for ex in exercises:
            equipments.update(ex.get("equipments", []))
            body_parts.update(ex.get("bodyParts", []))
            target_muscles.update(ex.get("targetMuscles", []))
        
        print(f"\nDistinct equipments: {len(equipments)}")
        print(f"Distinct body parts: {len(body_parts)}")
        print(f"Distinct target muscles: {len(target_muscles)}")
        
        # Check gifUrl coverage
        with_gif = sum(1 for ex in exercises if ex.get("gifUrl"))
        print(f"Exercises with gifUrl: {with_gif}/{len(exercises)} ({with_gif/len(exercises)*100:.1f}%)")

if __name__ == "__main__":
    asyncio.run(main())