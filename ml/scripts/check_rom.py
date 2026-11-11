import numpy as np
from pathlib import Path

DATA = Path('ml/data/keypoints_cached')
for p in DATA.glob('*.npz'):
    try:
        data = np.load(p)
        # Assuming npz has 'angles' key or similar structure
        if 'angles' in data:
            angles = data['angles'] # Shape (frames, joints)
            # Need to find the primary joint - usually index 0
            # Let's inspect the first one
            print(f"{p.name}: {angles.shape} min={np.percentile(angles[:,0], 5):.1f}, max={np.percentile(angles[:,0], 95):.1f}")
            break
    except Exception as e:
        pass
