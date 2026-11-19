"""Read-only provenance snapshot for the PoseTracker model audit."""
from __future__ import annotations

import hashlib
import importlib.util
import json
import os
import platform
import re
import subprocess
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import torch

ROOT = Path(__file__).resolve().parents[4]
ML = ROOT / "ml"
OUT = Path(__file__).resolve().parent
sys.path.insert(0, str(ML / "src"))

spec = importlib.util.spec_from_file_location("pose_audit_exp76", ML / "scripts" / "76_experiments.py")
exp = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(exp)

def sha(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()

artifacts = []
for base in (ML, ROOT / "mobile" / "assets", ROOT / "frontend" / "public" / "pose"):
    for path in sorted(base.rglob("*")):
        # Ignore packaged framework test fixtures inside the isolated Python env;
        # this inventory is for project-owned models/checkpoints and app assets.
        if ".venv" in path.parts or "site-packages" in path.parts:
            continue
        if path.is_file() and path.suffix.lower() in {".onnx", ".pt", ".task", ".tflite"}:
            artifacts.append({
                "path": path.relative_to(ROOT).as_posix(),
                "bytes": path.stat().st_size,
                "sha256": sha(path),
            })

keypoints = sorted((ML / "data" / "keypoints_pushupbench").glob("*.npz"))
data_hash = hashlib.sha256()
for path in keypoints:
    data_hash.update(path.name.encode())
    data_hash.update(b"\0")
    data_hash.update(sha(path).encode())
    data_hash.update(b"\n")

x, y, subjects, stems, classes = exp.load_dataset(48, 24, False, False)
class_summary = {}
for class_index, label in enumerate(classes):
    mask = y == class_index
    class_summary[label] = {
        "windows": int(mask.sum()),
        "subjects": int(len(set(subjects[mask]))),
        "videos": int(len(set(stems[mask]))),
    }

counts = {}
for name, model_name in (("cnn1d_7class", "cnn_avg"), ("attention_w48_7class", "cnn_attention")):
    model = exp.build_model(model_name, 132, len(classes))
    counts[name] = {"architecture": model.__class__.__name__, "parameters": sum(p.numel() for p in model.parameters())}

latency = {}
try:
    import onnxruntime as ort

    for name, path in (
        ("pattern_v1_fp32", ML / "models" / "pattern_v1" / "cnn1d.onnx"),
        ("attention_w48_fp32", ML / "models" / "experimental" / "attention_w48" / "cnn1d.onnx"),
    ):
        if not path.exists():
            continue
        options = ort.SessionOptions()
        options.intra_op_num_threads = 4
        options.inter_op_num_threads = 1
        session = ort.InferenceSession(str(path), sess_options=options, providers=["CPUExecutionProvider"])
        input_info = session.get_inputs()[0]
        sample = np.zeros((1, 48, 132), dtype=np.float32)
        for _ in range(10):
            session.run(None, {input_info.name: sample})
        elapsed = []
        for _ in range(100):
            started = time.perf_counter()
            session.run(None, {input_info.name: sample})
            elapsed.append((time.perf_counter() - started) * 1000)
        latency[name] = {
            "provider": session.get_providers()[0],
            "input": input_info.shape,
            "output": session.get_outputs()[0].shape,
            "p50_ms_batch1": round(float(np.percentile(elapsed, 50)), 4),
            "p95_ms_batch1": round(float(np.percentile(elapsed, 95)), 4),
            "runs": len(elapsed),
        }
except ImportError:
    latency = {"status": "onnxruntime unavailable in ml/.venv"}

map_file = ROOT / "backend" / "src" / "pose-tracker" / "catalog-tracking.generated.ts"
source = map_file.read_text(encoding="utf-8")
match = re.search(r"export const catalogTrackingMap:[^=]+ = (\{.*\});\s*$", source, re.S)
coverage = {"status": "generated map parse failed"}
if match:
    mapping = json.loads(match.group(1))
    catalog = json.loads((ML / "data" / "exercisedb_catalog.json").read_text(encoding="utf-8"))
    rows = catalog if isinstance(catalog, list) else catalog.get("data", catalog.get("items", []))
    ids = [row.get("exerciseId", row.get("_id", "")) for row in rows]
    support = Counter(mapping.get(identifier, {}).get("support", "MISSING") for identifier in ids)
    coverage = {
        "catalog_rows": len(rows),
        "unique_catalog_ids": len(set(ids)),
        "generated_map_entries": len(mapping),
        "support_counts": dict(sorted(support.items())),
        "catalog_ids_missing_from_map": sum(identifier not in mapping for identifier in ids),
        "generated_ids_not_in_catalog": sum(identifier not in set(ids) for identifier in mapping),
        "map_sha256": sha(map_file),
    }

try:
    gpu_text = subprocess.run(["nvidia-smi", "--query-gpu=name,memory.total,memory.free,compute_cap", "--format=csv,noheader"], capture_output=True, text=True, check=True).stdout.strip()
except Exception:
    gpu_text = "unavailable"

try:
    head = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
except Exception:
    head = "unavailable"

report = {
    "snapshot_date": "2026-11-17",
    "git_head": head,
    "environment": {
        "python": sys.version.split()[0],
        "platform": platform.platform(),
        "cpu": platform.processor(),
        "torch": torch.__version__,
        "cuda_available": torch.cuda.is_available(),
        "cuda_device": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
        "gpu": gpu_text,
        "torch_threads": torch.get_num_threads(),
        "inference_latency": latency,
    },
    "artifacts": artifacts,
    "pattern_dataset": {
        "source": "PushUpBench keypoint exports; CC-BY-4.0 per ml/DATA_LICENSES.md",
        "npz_files": len(keypoints),
        "raw_video_mp4_files": len(list((ML / "data" / "raw" / "real_video" / "pushupbench").glob("*.mp4"))),
        "all_npz_content_fingerprint_sha256": data_hash.hexdigest(),
        "deduplicated_subject_canonicalized_windows": int(len(x)),
        "canonical_subjects": int(len(set(subjects))),
        "classes": class_summary,
        "experimental_models": counts,
        "test_subjects_frozen_by_existing_harness": exp.TEST_SUBJECTS,
    },
    "exercisedb_tracking_map": coverage,
}
(OUT / "audit_snapshot.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps({
    "snapshot": str(OUT / "audit_snapshot.json"),
    "artifacts": len(artifacts),
    "dataset": report["pattern_dataset"],
    "coverage": coverage,
    "environment": report["environment"],
}, indent=2))
