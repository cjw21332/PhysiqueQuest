"""Sequential, local-only replay. Labels are frozen before any inference."""
import json, subprocess, hashlib, sys, argparse
from pathlib import Path
repo=Path.cwd(); manifest=repo/'patches/labels.local.json'
freeze=json.loads((repo/'patches/labels.freeze.json').read_text())
assert hashlib.sha256(manifest.read_bytes()).hexdigest()==freeze['manifest_sha256']
parser=argparse.ArgumentParser();parser.add_argument('--output',default='output/pose-replay-private/provisional-baseline-2026-11-21');args=parser.parse_args()
root=repo/args.output;root.mkdir(parents=True,exist_ok=True)
records=json.loads(manifest.read_text());seen=set()
for r in records:
 if r['video_sha256'] in seen:continue
 seen.add(r['video_sha256'])
 if r['exclude_from_baseline'] or r['label_confidence'] not in ['high','medium']:continue
 out=root/r['clip_id']
 if (out/'summary.json').exists():raise RuntimeError(f'Refusing to overwrite {out}')
 runner=Path(__file__).resolve().parent
 command=[sys.executable,str(runner/'offline-python.py'),'--manifest',str(manifest),'--file-match',Path(r['file']).name,'--exercise-id',r['app_exercise_id'],'--bridge',str(runner/'counter-bridge.cjs'),'--output',str(out)]
 (root/(r['clip_id']+'-command.json')).write_text(json.dumps(command,indent=2))
 print('RUN '+r['clip_id']+' '+Path(r['file']).name,flush=True)
 with (root/(r['clip_id']+'-process.log')).open('w') as log:
  result=subprocess.run(command,stdout=log,stderr=subprocess.STDOUT)
 if result.returncode:raise RuntimeError(f'{r["clip_id"]} failed; see process log; exit {result.returncode}')
 print('DONE '+r['clip_id']+' '+json.dumps(json.loads((out/'summary.json').read_text())),flush=True)
print('ALL ELIGIBLE UNIQUE CLIPS COMPLETED',flush=True)
