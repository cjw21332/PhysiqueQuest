"""Repeat only the counter on cached baseline landmarks; no model timing claim."""
import json, subprocess
from pathlib import Path

root=Path.cwd()
labels={x['clip_id']:x for x in json.loads((root/'patches/labels.local.json').read_text(encoding='utf8'))}
out=[]
for cid in ('c01','c06','c15','c17'):
    label=labels[cid]
    proc=subprocess.Popen(['node',str(root/'patches/files/scripts/pose-replay/counter-bridge.cjs')],stdin=subprocess.PIPE,stdout=subprocess.PIPE,text=True,encoding='utf8')
    def send(obj):
        proc.stdin.write(json.dumps(obj)+'\n');proc.stdin.flush()
        r=json.loads(proc.stdout.readline())
        if 'error' in r:raise RuntimeError(r['error'])
        return r
    # c15 shows parallel-bar dips. bZq4bwK describes bench dips, so use the
    # catalog's parallel-bar entry for this development diagnostic only.
    send({'type':'init','exerciseId':'K1vlode' if cid == 'c15' else label['app_exercise_id']})
    counters={}; events=[]
    for line in (root/f'output/pose-replay-private/provisional-baseline-2026-11-21/{cid}/frames.jsonl').open(encoding='utf8'):
        f=json.loads(line); points=f['landmarks']
        r=send({'type':'frame','poses':[points] if points else [],'timestampMs':f['timestampMs'],'aspect':f['inputWidth']/f['inputHeight']})
        for event in r['snapshot'].get('rejected',[]):
            counters[event['reason']]=counters.get(event['reason'],0)+1
        if r['repEvents']:events.extend(r['repEvents'])
    proc.stdin.close();proc.wait()
    out.append({'clip':cid,'snapshot':r['snapshot'],'rejected':counters,'events':events})
(root/'patches/development-mapping-diagnostic.json').write_text(json.dumps(out,indent=2),encoding='utf8')
print(json.dumps([{'clip':x['clip'],'full':x['snapshot']['reps'],'partial':x['snapshot']['partials'],'rejected':x['rejected']} for x in out],indent=2))
