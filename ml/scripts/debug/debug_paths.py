import sys
from pathlib import Path

# Get the script directory
script_path = Path(__file__).resolve()
print(f"Script path: {script_path}")

# Get project root (one level up from scripts)
project_root = script_path.parents[1]
print(f"Project root: {project_root}")

# Get cache path as defined in script
script_dir = Path(__file__).resolve().parent
script_cachedir = script_dir / 'ml' / 'data' / 'keypoints_repcount'
print(f"Script's CACHE path: {script_cachedir}")

# Check if file exists
print(f"CACHE file exists: {script_cachedir / 'test_train143.npz'}.exists()")

# Let's also check what the actual cache directory contains
print(f"Contents of CACHE directory:")
for f in sorted(Path(script_cachedir).glob('*.npz'))[:10]:
    print(f"  {f.name}")