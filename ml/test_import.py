import mediapipe as mp
print("mediapipe.tasks:", dir(mp.tasks))
print()
# Try to import vision submodule
try:
    import mediapipe.tasks.vision as v
    print("vision module:", dir(v))
except ImportError as e:
    print(f"Import error: {e}")

# Try alternative import
try:
    from mediapipe.tasks import vision
    print("from mediapipe.tasks import vision works")
    print(dir(vision))
except ImportError as e:
    print(f"from import error: {e}")
    
# Check RunningMode
try:
    from mediapipe.tasks.vision import RunningMode
    print(f"RunningMode.IMAGE={RunningMode.IMAGE}")
except ImportError as e:
    print(f"RunningMode import error: {e}")
    
# Check PoseLandmarkerOptions
try:
    opts = mp.tasks.vision.PoseLandmarkerOptions
    print(f"PoseLandmarkerOptions available")
except AttributeError as e:
    print(f"PoseLandmarkerOptions error: {e}")
PYEOF