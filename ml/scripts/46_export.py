#!/usr/bin/env python3
"""Export ONNX models to int8 and create manifest."""
import os
import json
import hashlib
import subprocess
from pathlib import Path
from typing import Dict
import numpy as np
import onnx
import onnxruntime as ort
from onnxruntime.quantization import quantize_dynamic, QuantType

# ── Paths ──────────────────────────────────────────────────────────────────
MODELS_DIR = Path("ml/models")
MODELS_DIR.mkdir(parents=True, exist_ok=True)

# Load class mapping
with open("data/manifests/splits_v1.csv") as f:
    import pandas as pd
df = pd.read_csv("data/manifests/splits_v1.csv")
classes = sorted(df["class"].unique())
class_to_idx = {c: i for i, c in enumerate(classes)}
idx_to_class = {v: k for k, v in class_to_idx.items()}

# Load pose model hash
pose_model_path = Path("models/pose_landmarker_lite.task")
pose_hash = hashlib.sha256(pose_model_path.read_bytes()).hexdigest()

# Data inventory hash
with open("data/manifests/splits_v1.csv", "rb") as f:
    data_hash = hashlib.sha256(f.read()).hexdigest()


def quantize_model(input_path: Path, output_path: Path):
    """Quantize ONNX model to int8 using dynamic quantization."""
    print(f"Quantizing {input_path.name} -> {output_path.name}")
    quantize_dynamic(
        model_input=str(input_path),
        model_output=str(output_path),
        weight_type=QuantType.QInt8,
    )
    print(f"  Quantized size: {output_path.stat().st_size / 1024:.1f} KB")


def check_parity(original_path: Path, quantized_path: Path, num_samples: int = 100):
    """Compare original and quantized model outputs."""
    print(f"Checking parity: {original_path.name} vs {quantized_path.name}")
    
    # Create test inputs
    np.random.seed(42)
    test_inputs = np.random.randn(num_samples, 48, 132).astype(np.float32)
    
    # Original
    ort_session_orig = ort.InferenceSession(str(original_path))
    input_name = ort_session_orig.get_inputs()[0].name
    orig_outputs = []
    for x in test_inputs:
        out = ort_session_orig.run(None, {input_name: x[None, :]})
        orig_outputs.append(out[0])
    orig_outputs = np.array(orig_outputs)
    
    # Quantized
    ort_session_quant = ort.InferenceSession(str(quantized_path))
    input_name = ort_session_quant.get_inputs()[0].name
    quant_outputs = []
    for x in test_inputs:
        out = ort_session_quant.run(None, {input_name: x[None, :]})
        quant_outputs.append(out[0])
    quant_outputs = np.array(quant_outputs)
    
    # Metrics
    top1_agree = np.mean(np.argmax(orig_outputs, axis=1) == np.argmax(quant_outputs, axis=1))
    max_logit_diff = np.max(np.abs(orig_outputs - quant_outputs))
    mean_logit_diff = np.mean(np.abs(orig_outputs - quant_outputs))
    
    print(f"  Top-1 agreement: {top1_agree:.4f}")
    print(f"  Max logit diff: {max_logit_diff:.6f}")
    print(f"  Mean logit diff: {mean_logit_diff:.6f}")
    
    return {
        "top1_agreement": float(top1_agree),
        "max_logit_diff": float(max_logit_diff),
        "mean_logit_diff": float(mean_logit_diff),
    }


def get_model_info(model_path: Path) -> Dict:
    """Extract model metadata."""
    stat = model_path.stat()
    model = onnx.load(str(model_path))
    
    # Get input/output shapes
    input_shape = [dim.dim_value if dim.dim_value > 0 else -1 
                   for dim in model.graph.input[0].type.tensor_type.shape.dim]
    output_shape = [dim.dim_value if dim.dim_value > 0 else -1
                    for dim in model.graph.output[0].type.tensor_type.shape.dim]
    
    return {
        "file": model_path.name,
        "size_bytes": stat.st_size,
        "size_kb": round(stat.st_size / 1024, 1),
        "sha256": hashlib.sha256(model_path.read_bytes()).hexdigest(),
        "input_shape": input_shape,
        "output_shape": output_shape,
        "opset": model.opset_import[0].version if model.opset_import else 13,
    }


def main():
    print("=== EXPORT AND MANIFEST ===\n")
    
    models_to_process = ["cnn1d.onnx", "gru.onnx"]
    results = {}
    
    for model_name in models_to_process:
        input_path = MODELS_DIR / model_name
        if not input_path.exists():
            print(f"Missing: {model_name}")
            continue
        
        quant_name = model_name.replace(".onnx", "_int8.onnx")
        quant_path = MODELS_DIR / quant_name
        
        # Quantize
        quantize_model(input_path, quant_path)
        
        # Parity check
        parity = check_parity(input_path, quant_path)
        
        # Model info
        orig_info = get_model_info(input_path)
        quant_info = get_model_info(quant_path)
        
        results[model_name] = {
            "original": orig_info,
            "quantized": quant_info,
            "parity": parity,
        }
    
    # Create manifest
    try:
        import git
        repo = git.Repo(".")
        git_hash = repo.head.object.hexsha
    except:
        git_hash = "unknown"
    
    manifest = {
        "version": "1.0.0",
        "date": "2026-11-09",
        "git_hash": git_hash,
        "pose_model": {
            "file": "pose_landmarker_lite.task",
            "sha256": pose_hash,
        },
        "data_inventory_hash": data_hash,
        "feature_spec_ref": "docs/FEATURE_SPEC.md",
        "labels": classes,
        "class_to_idx": class_to_idx,
        "models": results,
        "thresholds": {
            "classification_confidence": 0.5,
            "open_set_rejection": 0.3,
        },
        "mapping_version": "taxonomy_v1",
        "input_spec": {
            "window_size": 48,
            "features_per_frame": 132,
            "fps": 15,
            "normalization": "mid_hip_center_torso_length",
        },
    }
    
    manifest_path = MODELS_DIR / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    
    print(f"\n=== MANIFEST ===")
    print(f"Saved to {manifest_path}")
    print(json.dumps(manifest, indent=2))
    
    # Verify quantized models are < 1MB
    for model_name in models_to_process:
        quant_name = model_name.replace(".onnx", "_int8.onnx")
        quant_path = MODELS_DIR / quant_name
        size_mb = quant_path.stat().st_size / (1024 * 1024)
        status = "OK" if size_mb < 1.0 else "TOO LARGE"
        print(f"{quant_name}: {size_mb:.2f} MB {status}")


if __name__ == "__main__":
    main()