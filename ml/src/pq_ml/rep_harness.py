"""Call the real TypeScript rep counter from Python."""
import json
from pathlib import Path
import subprocess

import numpy as np

HARNESS = Path(__file__).resolve().parents[2] / 'scripts' / 'rep_harness.mjs'


def count_landmarks(landmarks, timestamps_ms, aspect, angle_config, counter_config=None, node='node'):
    """Count frames in image-normalized coordinates, with monotonic millisecond timestamps."""
    payload = {
        'landmarks': np.asarray(landmarks).tolist(),
        'timestamps': np.asarray(timestamps_ms).tolist(),
        'aspect': float(aspect),
        'angleConfig': angle_config,
        'counterConfig': counter_config or {},
    }
    result = subprocess.run([node, str(HARNESS), '-'], input=json.dumps(payload, allow_nan=False),
                            capture_output=True, text=True, check=True)
    return json.loads(result.stdout)
