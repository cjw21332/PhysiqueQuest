"""Replay remaining eligible development videos once at 15 Hz; no test clips."""
import json, subprocess, sys
from pathlib import Path

root = Path.cwd()
labels = {row['clip_id']: row for row in json.loads((root/'patches/labels.local.json').read_text(encoding='utf8'))}
for cid in ('c01', 'c06', 'c15'):
    row = labels[cid]
    assert row['split'] == 'DEVELOPMENT'
    output = root/'output/pose-replay-private'/f'{cid}-15hz-development'
    command = [sys.executable, 'patches/files/scripts/pose-replay/offline-python.py', '--manifest', 'patches/labels.local.json', '--file-match', Path(row['file']).name, '--exercise-id', 'K1vlode' if cid == 'c15' else row['app_exercise_id'], '--bridge', 'patches/files/scripts/pose-replay/counter-bridge.cjs', '--output', str(output), '--fps', '15']
    print('RUN', cid, flush=True)
    subprocess.run(command, check=True)
