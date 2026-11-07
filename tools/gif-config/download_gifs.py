"""
GIF Download Module

Downloads ExerciseDB GIFs to local cache with rate limiting, retries, and resume support.
"""

import asyncio
import aiohttp
import json
import time
import hashlib
from pathlib import Path
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
from tqdm import tqdm

from config import (
    GIF_CACHE_DIR,
    DOWNLOAD_RATE_LIMIT_MS,
    DOWNLOAD_MAX_RETRIES,
    DOWNLOAD_BACKOFF_BASE,
    DOWNLOAD_TIMEOUT_S,
    MONGODB_URI,
    CATALOG_DB_NAME,
    CATALOG_COLLECTION,
    LOGGER,
)
import pymongo


@dataclass
class ExerciseRecord:
    exerciseId: str
    name: str
    gifUrl: str
    bodyParts: List[str]
    equipments: List[str]
    targetMuscles: List[str]
    secondaryMuscles: List[str]
    instructions: List[str]


@dataclass
class DownloadResult:
    exerciseId: str
    success: bool
    localPath: Optional[str] = None
    error: Optional[str] = None
    fileSize: Optional[int] = None
    contentType: Optional[str] = None


class GifDownloader:
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self.last_request_time = 0.0
        self.failed_downloads: List[Dict[str, Any]] = []
        self.failed_path = GIF_CACHE_DIR.parent / "failed_downloads.json"

    async def __aenter__(self):
        timeout = aiohttp.ClientTimeout(total=DOWNLOAD_TIMEOUT_S)
        self.session = aiohttp.ClientSession(timeout=timeout)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def _rate_limit(self):
        """Enforce rate limiting between requests."""
        now = time.time()
        elapsed = (now - self.last_request_time) * 1000
        if elapsed < DOWNLOAD_RATE_LIMIT_MS:
            await asyncio.sleep((DOWNLOAD_RATE_LIMIT_MS - elapsed) / 1000)
        self.last_request_time = time.time()

    def _get_local_path(self, exercise_id: str) -> Path:
        """Get local cache path for an exercise GIF."""
        return GIF_CACHE_DIR / f"{exercise_id}.gif"

    def _file_exists_and_valid(self, path: Path) -> bool:
        """Check if file exists and has content."""
        return path.exists() and path.stat().st_size > 0

    async def download_gif(self, exercise: ExerciseRecord) -> DownloadResult:
        """Download a single GIF with retries and backoff."""
        local_path = self._get_local_path(exercise.exerciseId)

        # Resume: skip if already downloaded and valid
        if self._file_exists_and_valid(local_path):
            return DownloadResult(
                exerciseId=exercise.exerciseId,
                success=True,
                localPath=str(local_path),
                fileSize=local_path.stat().st_size,
            )

        gif_url = exercise.gifUrl
        if not gif_url:
            return DownloadResult(
                exerciseId=exercise.exerciseId,
                success=False,
                error="No GIF URL in catalog record",
            )

        last_error = None
        for attempt in range(DOWNLOAD_MAX_RETRIES):
            try:
                await self._rate_limit()

                async with self.session.get(gif_url) as response:
                    if response.status == 404:
                        return DownloadResult(
                            exerciseId=exercise.exerciseId,
                            success=False,
                            error=f"GIF not found (404): {gif_url}",
                        )
                    response.raise_for_status()

                    content_type = response.headers.get("Content-Type", "")
                    content = await response.read()

                    # Verify it's actually a GIF
                    if not content.startswith(b"GIF"):
                        return DownloadResult(
                            exerciseId=exercise.exerciseId,
                            success=False,
                            error=f"Downloaded content is not a GIF (starts with: {content[:12]})",
                        )

                    # Write to cache
                    local_path.write_bytes(content)

                    return DownloadResult(
                        exerciseId=exercise.exerciseId,
                        success=True,
                        localPath=str(local_path),
                        fileSize=len(content),
                        contentType=content_type,
                    )

            except asyncio.TimeoutError:
                last_error = f"Timeout after {DOWNLOAD_TIMEOUT_S}s"
            except aiohttp.ClientError as e:
                last_error = f"HTTP error: {e}"
            except Exception as e:
                last_error = f"Unexpected error: {e}"

            # Exponential backoff
            if attempt < DOWNLOAD_MAX_RETRIES - 1:
                backoff = DOWNLOAD_BACKOFF_BASE ** attempt
                LOGGER.warning(f"Retry {attempt + 1}/{DOWNLOAD_MAX_RETRIES} for {exercise.exerciseId} after {backoff}s: {last_error}")
                await asyncio.sleep(backoff)

        # All retries failed
        error_msg = last_error or "Unknown error"
        self.failed_downloads.append({
            "exerciseId": exercise.exerciseId,
            "name": exercise.name,
            "gifUrl": gif_url,
            "error": error_msg,
            "attempts": DOWNLOAD_MAX_RETRIES,
        })

        return DownloadResult(
            exerciseId=exercise.exerciseId,
            success=False,
            error=error_msg,
        )

    def save_failed_downloads(self):
        """Save failed downloads to JSON for later inspection."""
        if self.failed_downloads:
            with open(self.failed_path, "w") as f:
                json.dump(self.failed_downloads, f, indent=2)
            LOGGER.info(f"Saved {len(self.failed_downloads)} failed downloads to {self.failed_path}")


def load_catalog_from_mongodb() -> List[ExerciseRecord]:
    """Load all exercises from MongoDB catalog (read-only)."""
    LOGGER.info("Connecting to configured catalog database")
    client = pymongo.MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
    db = client[CATALOG_DB_NAME]
    collection = db[CATALOG_COLLECTION]

    # Count total
    total = collection.count_documents({})
    LOGGER.info(f"Found {total} exercises in catalog")

    # Fetch all records
    cursor = collection.find(
        {},
        {
            "exerciseId": 1,
            "name": 1,
            "gifUrl": 1,
            "bodyParts": 1,
            "equipments": 1,
            "targetMuscles": 1,
            "secondaryMuscles": 1,
            "instructions": 1,
        }
    ).sort("exerciseId", 1)

    exercises = []
    for doc in cursor:
        exercises.append(ExerciseRecord(
            exerciseId=doc.get("exerciseId", ""),
            name=doc.get("name", ""),
            gifUrl=doc.get("gifUrl", ""),
            bodyParts=doc.get("bodyParts", []),
            equipments=doc.get("equipments", []),
            targetMuscles=doc.get("targetMuscles", []),
            secondaryMuscles=doc.get("secondaryMuscles", []),
            instructions=doc.get("instructions", []),
        ))

    client.close()
    return exercises


async def main():
    """Download all GIFs from catalog."""
    LOGGER.info("Starting GIF download pipeline")

    # Load catalog
    exercises = load_catalog_from_mongodb()
    LOGGER.info(f"Loaded {len(exercises)} exercises")

    # Download all GIFs
    downloader = GifDownloader()
    async with downloader:
        results = []
        for exercise in tqdm(exercises, desc="Downloading GIFs"):
            result = await downloader.download_gif(exercise)
            results.append(result)

            if not result.success:
                LOGGER.warning(f"Failed: {exercise.exerciseId} ({exercise.name}) - {result.error}")

        # Summary
        successful = sum(1 for r in results if r.success)
        failed = len(results) - successful
        LOGGER.info(f"Download complete: {successful} successful, {failed} failed")

        downloader.save_failed_downloads()

        # Save results summary
        summary = {
            "total": len(results),
            "successful": successful,
            "failed": failed,
            "results": [asdict(r) for r in results],
        }
        summary_path = GIF_CACHE_DIR.parent / "download_summary.json"
        with open(summary_path, "w") as f:
            json.dump(summary, f, indent=2)
        LOGGER.info(f"Download summary saved to {summary_path}")


if __name__ == "__main__":
    asyncio.run(main())
