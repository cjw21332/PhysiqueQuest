"""Checks the contribution export -> npz ingest used for PhysiqueQuest clips."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import numpy as np
import pytest

ML = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("ingest75", ML / "scripts" / "75_ingest_contributions.py")
ingest = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(ingest)


def write_export(root: Path, *, extra: dict | None = None, frames: int = 90) -> Path:
    clip = "a" * 24
    timestamps = [round(i * 1000 / 15, 3) for i in range(frames)]
    body = [
        [((i + j) % 7) / 10 for j in range(132)]
        for i in range(frames)
    ]
    payload = {"payloadVersion": "feature-spec-1.1", "fps": 15, "timestampsMs": timestamps, "frames": body}
    record = {
        "clipId": clip,
        "subjectPseudonym": "study-code-abcdef123456",
        "exerciseId": "squat",
        "exerciseName": "Bodyweight squat",
        "pattern": "squat",
        "correctness": "correct",
        "cameraPlacement": "diagonal",
        "cameraFacing": "back",
        "orientation": "portrait",
        "durationSeconds": 6.0,
        "consentVersion": "2026-11-16.v1",
        "annotation": {"keypointQuality": "good", "repBoundaries": [{"startFrame": 2, "endFrame": 20}], "phases": [], "formDeviations": []},
        "payload": payload,
        **(extra or {}),
    }
    directory = root / "squat"
    directory.mkdir(parents=True)
    (directory / f"{clip}.json").write_text(json.dumps(record))
    manifest = {
        "dataset": "physiquequest_contributions",
        "version": "test-v1",
        "licence": "research use",
        "clips": 1,
        "files": [{"clipId": clip, "file": f"squat/{clip}.json"}],
    }
    (root / "manifest.json").write_text(json.dumps(manifest))
    return root


def test_ingest_writes_npz_and_manifest(tmp_path, monkeypatch):
    export = write_export(tmp_path / "export")
    out = tmp_path / "npz"
    monkeypatch.setattr("sys.argv", ["75", "--input", str(export), "--out", str(out)])
    assert ingest.main() == 0
    npz = np.load(out / f"{'a' * 24}.npz")
    assert npz["landmarks"].shape == (90, 33, 4)
    assert npz["timestamps_ms"].shape == (90,)
    assert npz["detection_mask"].all()
    manifest = json.loads((out.parent / "manifests" / "contributions_test-v1.json").read_text())
    assert manifest["clips"] == 1
    assert manifest["subjects_by_pattern"]["squat"] == 1
    assert manifest["insufficient_for_split"] == ["squat"]
    assert manifest["files"][0]["rep_boundaries"]


def test_ingest_refuses_identity_fields(tmp_path):
    export = write_export(tmp_path / "leaky", extra={"userId": "507f1f77bcf86cd799439011"})
    with pytest.raises(SystemExit, match="identity fields"):
        ingest.load_export(export)
