#!/usr/bin/env python3
"""Task 3: Search Hugging Face for legitimate exercise/fitness datasets."""
import json
import sys
from pathlib import Path
from huggingface_hub import HfApi

api = HfApi()

search_terms = [
    "exercise", "fitness", "workout", "squat", "pushup", "push-up",
    "lunge", "deadlift", "bench press", "pullup", "pull-up",
    "bicep curl", "curl", "shoulder press", "plank",
    "human pose", "pose estimation", "action recognition",
    "kinetics", "ucf101", "penn action", "rep count",
]

results = []
for term in search_terms:
    print(f"Searching: {term}")
    try:
        datasets = list(api.list_datasets(search=term, limit=20))
        for ds in datasets:
            try:
                info = api.dataset_info(ds.id)
                results.append({
                    "search_term": term,
                    "repo_id": ds.id,
                    "description": str(getattr(info, 'description', '') or '')[:200],
                    "tags": list(getattr(info, 'tags', []) or []),
                    "size_bytes": int(getattr(info, 'size_in_bytes', 0) or 0),
                    "downloads": int(getattr(info, 'downloads', 0) or 0),
                    "likes": int(getattr(info, 'likes', 0) or 0),
                    "private": bool(getattr(info, 'private', False) or False),
                })
            except Exception as e:
                print(f"  Error getting info for {ds.id}: {e}")
    except Exception as e:
        print(f"  Search error: {e}")

# Save results
out_path = Path("reports/hf_candidates.json")
out_path.parent.mkdir(parents=True, exist_ok=True)
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2, ensure_ascii=False)

# Also save as markdown
md_path = Path("reports/hf_candidates.md")
with open(md_path, "w", encoding="utf-8") as f:
    f.write("# Hugging Face Dataset Candidates for Exercise Video\n\n")
    f.write(f"Total found: {len(results)}\n\n")
    f.write("| Repo ID | Search Term | Description | Tags | Size (GB) | Downloads | Likes | Private |\n")
    f.write("|---------|-------------|-------------|------|-----------|-----------|-------|---------|\n")
    for r in results:
        size_gb = r["size_bytes"] / (1024**3) if r["size_bytes"] else 0
        tags = ", ".join(r["tags"][:5]) if r["tags"] else ""
        desc = r["description"].replace("|", "\\|").replace("\n", " ")[:100]
        f.write(f"| {r['repo_id']} | {r['search_term']} | {desc} | {tags} | {size_gb:.2f} | {r['downloads']} | {r['likes']} | {r['private']} |\n")

print(f"\nSaved {len(results)} candidates to {out_path} and {md_path}")