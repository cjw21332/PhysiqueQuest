#!/usr/bin/env python3
"""Environment smoke test for ML pipeline."""
import sys
import torch
import numpy as np
import cv2
import mediapipe as mp
import onnx
import onnxruntime as ort
import onnxsim
import matplotlib
print("Python:", sys.version)
print("PyTorch:", torch.__version__, "CUDA:", torch.cuda.is_available())
if torch.cuda.is_available():
    print("GPU:", torch.cuda.get_device_name(0))
print("NumPy:", np.__version__)
print("OpenCV:", cv2.__version__)
print("MediaPipe:", mp.__version__)
print("ONNX:", onnx.__version__)
print("ONNX Runtime:", ort.__version__)
print("ONNX Simplifier:", onnxsim.__version__)
print("Matplotlib:", matplotlib.__version__)

# Test MediaPipe Pose
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import tempfile
import os

# Create a dummy image for testing
img = np.zeros((480, 640, 3), dtype=np.uint8)
cv2.rectangle(img, (100, 100), (300, 300), (255, 255, 255), -1)

# We can't easily test MediaPipe without the model file, but we can verify imports
print("\n[OK] All imports successful")

# Test PyTorch forward/backward on CUDA
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = torch.nn.Sequential(
    torch.nn.Linear(10, 32),
    torch.nn.ReLU(),
    torch.nn.Linear(32, 5)
).to(device)
x = torch.randn(2, 10, device=device)
y = model(x)
loss = y.sum()
loss.backward()
print(f"[OK] PyTorch forward/backward on {device} successful")

# Test ONNX export
dummy_input = torch.randn(1, 10)
torch.onnx.export(model.cpu(), dummy_input, "test_model.onnx", opset_version=13)
print("[OK] ONNX export successful")

# Test ONNX simplification
onnx_model = onnx.load("test_model.onnx")
simplified, check = onnxsim.simplify(onnx_model)
assert check, "ONNX simplification failed"
print("[OK] ONNX simplification successful")

# Test ONNX Runtime inference
ort_session = ort.InferenceSession("test_model.onnx")
ort_inputs = {ort_session.get_inputs()[0].name: dummy_input.numpy()}
ort_outputs = ort_session.run(None, ort_inputs)
print("[OK] ONNX Runtime inference successful")

# Cleanup
os.remove("test_model.onnx")

print("\n=== ALL SMOKE TESTS PASSED ===")