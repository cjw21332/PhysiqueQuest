#!/usr/bin/env python3
"""Phase 6: why does INT8 degrade, and which mobile format is actually usable?

Compares, on the same windows:
  fp32                 ONNX float reference
  fp16                 half precision (halves size, CPU support varies)
  int8_dynamic         what pattern_v1 shipped (MatMul/Gemm weights only)
  int8_dynamic_pc      per-channel weights
  int8_dynamic_conv    per-channel + Conv quantised too
  int8_static_qdq      calibrated QDQ, per-channel, uint8 activations

Selection metric is macro-F1 on the non-test subjects (val pool). The frozen
test set is reported for transparency but is not used to choose the format.

Usage
  python scripts/77_quantize_experiments.py --model models/pattern_v1/cnn1d.onnx --report reports/quantization_v1.json
  python scripts/77_quantize_experiments.py --model models/pattern_v2/cnn1d.onnx --window 48 --features 132
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import sys
import time
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
from sklearn.metrics import f1_score

ML = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ML / "src"))

SPEC = importlib.util.spec_from_file_location("exp76", ML / "scripts" / "76_experiments.py")
exp = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(exp)


def metrics(session, x, y):
    logits = session.run(None, {"input": x.astype(np.float32)})[0]
    pred = logits.argmax(1)
    return {
        "accuracy": round(float((pred == y).mean()), 4),
        "macro_f1": round(float(f1_score(y, pred, average="macro", zero_division=0)), 4),
    }


def latency_ms(session, sample, runs=120):
    session.run(None, {"input": sample})
    timings = []
    for _ in range(runs):
        started = time.perf_counter()
        session.run(None, {"input": sample})
        timings.append((time.perf_counter() - started) * 1000)
    return round(float(np.median(timings)), 3)


class CalibrationReader:  # duck-typed CalibrationDataReader
    def __init__(self, windows: np.ndarray):
        self.items = [{"input": window[None].astype(np.float32)} for window in windows]
        self.index = 0

    def get_next(self):
        if self.index >= len(self.items):
            return None
        item = self.items[self.index]
        self.index += 1
        return item

    def rewind(self):
        self.index = 0


def build_variants(src: Path, out_dir: Path, calibration: np.ndarray) -> dict[str, Path | str]:
    from onnxruntime.quantization import QuantFormat, QuantType, quantize_dynamic, quantize_static

    out_dir.mkdir(parents=True, exist_ok=True)
    variants: dict[str, Path | str] = {"fp32": src}

    fp16_path = out_dir / "fp16.onnx"
    try:
        from onnxruntime.transformers.float16 import convert_float_to_float16

        model = onnx.load(str(src))
        fp16_model = convert_float_to_float16(model, keep_io_types=True)
        onnx.save(fp16_model, str(fp16_path))
        variants["fp16"] = fp16_path
    except Exception as exc:  # pragma: no cover - depends on ORT build
        variants["fp16"] = f"unavailable: {type(exc).__name__}: {exc}"

    def dynamic(name: str, **kwargs):
        target = out_dir / f"{name}.onnx"
        try:
            quantize_dynamic(str(src), str(target), weight_type=QuantType.QInt8, **kwargs)
            variants[name] = target
        except Exception as exc:  # pragma: no cover
            variants[name] = f"unavailable: {type(exc).__name__}: {exc}"

    dynamic("int8_dynamic")
    dynamic("int8_dynamic_pc", per_channel=True)
    dynamic("int8_dynamic_conv", per_channel=True, op_types_to_quantize=["MatMul", "Gemm", "Conv"])

    def static(name: str, **kwargs):
        target = out_dir / f"{name}.onnx"
        try:
            quantize_static(
                str(src), str(target), CalibrationReader(calibration),
                quant_format=QuantFormat.QDQ, weight_type=QuantType.QInt8, **kwargs,
            )
            variants[name] = target
        except Exception as exc:  # pragma: no cover
            variants[name] = f"unavailable: {type(exc).__name__}: {exc}"

    static("int8_static_qdq", per_channel=True, activation_type=QuantType.QUInt8)
    static("int8_static_qdq_sym", per_channel=True, activation_type=QuantType.QInt8)
    static("int8_static_tensor", per_channel=False, activation_type=QuantType.QUInt8)
    return variants


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--model", type=Path, required=True)
    ap.add_argument("--window", type=int, default=48)
    ap.add_argument("--features", type=int, default=132)
    ap.add_argument("--out", type=Path, default=None)
    ap.add_argument("--report", type=Path, default=None)
    ap.add_argument("--calibration-windows", type=int, default=400)
    args = ap.parse_args()

    out_dir = args.out or args.model.parent / "quantized"
    drop_visibility = args.features != 132
    x, y, subjects, _stems, classes = exp.load_dataset(args.window, 24, drop_visibility, False)
    test_mask = np.isin(subjects, exp.TEST_SUBJECTS)
    val_idx = np.flatnonzero(~test_mask)
    test_idx = np.flatnonzero(test_mask)
    # Class-balanced calibration: an unstratified sample under-represents the
    # small classes and is the likely reason v1's quantised model collapsed.
    rng = np.random.default_rng(7)
    per_class = max(1, args.calibration_windows // len(np.unique(y[val_idx])))
    chosen = []
    for label in np.unique(y[val_idx]):
        candidates = val_idx[y[val_idx] == label]
        chosen.extend(rng.choice(candidates, size=min(per_class, len(candidates)), replace=False))
    calibration = x[np.asarray(chosen)]

    variants = build_variants(args.model, out_dir, calibration)
    reference = None
    rows = []
    for name, path in variants.items():
        if not isinstance(path, Path):
            rows.append({"format": name, "status": path})
            continue
        try:
            session = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
        except Exception as exc:  # pragma: no cover
            rows.append({"format": name, "status": f"load failed: {type(exc).__name__}: {exc}"})
            continue
        entry = {
            "format": name,
            "status": "ok",
            "size_bytes": path.stat().st_size,
            "val": metrics(session, x[val_idx], y[val_idx]),
            "test": metrics(session, x[test_idx], y[test_idx]),
            "latency_ms_batch1": latency_ms(session, x[test_idx][:1]),
        }
        if reference is None:
            reference = entry["val"]["macro_f1"]
        entry["val_delta_vs_fp32"] = round(entry["val"]["macro_f1"] - reference, 4)
        rows.append(entry)
        print(f"{name:18} size={entry['size_bytes']:>8} val_f1={entry['val']['macro_f1']:.3f} "
              f"test_f1={entry['test']['macro_f1']:.3f} latency={entry['latency_ms_batch1']:.2f}ms")

    payload = {
        "model": str(args.model),
        "window": args.window,
        "features": args.features,
        "classes": classes,
        "val_windows": int(len(val_idx)),
        "test_windows": int(len(test_idx)),
        "gate": {"max_val_macro_f1_drop": 0.015, "max_size_bytes": 1_000_000},
        "variants": rows,
    }
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(payload, indent=2))
    passing = [
        row for row in rows
        if row.get("status") == "ok" and row["val_delta_vs_fp32"] >= -0.015 and row["size_bytes"] < 1_000_000
    ]
    # Among formats that hold accuracy, prefer the smallest that is not FP32.
    compressed = [row for row in passing if row["format"] != "fp32"]
    best = min(compressed or passing, key=lambda row: row["size_bytes"]) if passing else None
    payload["selection"] = {"passing_formats": [row["format"] for row in passing],
                            "best_mobile_format": best["format"] if best else None}
    if args.report:
        args.report.write_text(json.dumps(payload, indent=2))
    print("\nformats meeting gate (val drop <= 0.015, <1MB):", payload["selection"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
