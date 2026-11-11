"""Render shareable outputs from an existing completed GIF harness run."""
import csv
import json
from pathlib import Path
import matplotlib.pyplot as plt
import matplotlib.image as mpimg
import numpy as np

out = Path(__file__).resolve().parents[1] / 'reports/gif_harness'
rows = json.loads((out / 'tile_results.json').read_text(encoding='utf-8'))
failures = [row for row in rows if not row['exact']]
with (out / 'failing_exercises.csv').open('w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=list(failures[0]))
    writer.writeheader(); writer.writerows(failures)
configs = {c['exercise_id']:c for c in json.loads((out / 'candidate_configs.json').read_text(encoding='utf-8'))}
paths = []
for row in rows:
    eid = row['exercise_id']; ids = configs[eid].get('primary_joints', [])
    if len(ids) != 3: continue
    data = np.load(out.parent.parent / 'data/keypoints_raw_gif' / f'{eid}.npz')
    points = data['landmarks']; a,b,c = (points[:,i,:2] for i in ids)
    scale = np.array([float(data['width'])/float(data['height']),1])
    v=(a-b)*scale; u=(c-b)*scale; norm=np.linalg.norm(v,axis=1)*np.linalg.norm(u,axis=1)
    valid=(points[:,ids,3].min(axis=1)>=.5)&(norm>1e-9)&data['detection_mask']
    if valid.sum() < 3: continue
    angle=np.full(len(points),np.nan); angle[valid]=np.degrees(np.arccos(np.clip(np.sum(v[valid]*u[valid],axis=1)/norm[valid],-1,1)))
    path=out/f'{eid}_raw.png'; fig,ax=plt.subplots(); ax.plot(data['timestamps_ms']/1000,angle); ax.set(xlabel='time (s)',ylabel='joint angle (degrees)',title=eid); fig.tight_layout(); fig.savefig(path); plt.close(fig)
    paths.append(path)
    if len(paths)==10: break
fig, axes = plt.subplots(5, 2, figsize=(16, 18))
for ax, path in zip(axes.flat, paths):
    ax.imshow(mpimg.imread(path)); ax.axis('off')
fig.tight_layout(); fig.savefig(out / 'ten_curves.png', dpi=110); plt.close(fig)
print(f'failures={len(failures)} curves={len(paths)}')
