"""Aggregate existing CURRENT-code traces; never changes labels or runtime code."""
from pathlib import Path
import json, hashlib, math, csv
repo=Path.cwd();root=repo/'output/pose-replay-private/provisional-baseline-2026-11-21'
manifest=repo/'patches/labels.local.json'; frozen=json.loads((repo/'patches/labels.freeze.json').read_text())
assert hashlib.sha256(manifest.read_bytes()).hexdigest()==frozen['manifest_sha256']
labels=json.loads(manifest.read_text()); result=[]; windows=[]; events=[]
def quant(values,p):
 return sorted(values)[max(0,math.ceil(p*len(values))-1)] if values else None
def stats(rows):
 a=[r['inferenceMs'] for r in rows];b=[r['inferenceMs'] for r in rows if not r['missingWorkingTriplet']]
 return dict(n=len(a),p50=quant(a,.5),p90=quant(a,.9),p95=quant(a,.95),p99=quant(a,.99),max=max(a) if a else None,usable_working_triplet_frames=len(b),usable_triplet_p95=quant(b,.95))
for label in labels:
 if label['exclude_from_baseline']:continue
 cid=label['clip_id'];d=root/cid; summary=json.loads((d/'summary.json').read_text());prov=json.loads((d/'provenance.json').read_text());cfg=json.loads((d/'configuration.json').read_text())
 for name,h in prov['sourceHashes'].items():assert hashlib.sha256((repo/name).read_bytes()).hexdigest()==h, name
 frames=[json.loads(s) for s in (d/'frames.jsonl').read_text().splitlines()];n=len(frames)
 thirds=[stats(frames[n*k//3:n*(k+1)//3]) for k in range(3)]
 for t in range(0,math.ceil(n/10),5):
  sample=[r for r in frames if t<=r['timestampMs']/1000<t+5]; windows.append(dict(clip_id=cid,start_s=t,end_s=min(t+5,n/10),**stats(sample)))
 for r in frames:
  if r['repEvents'] or r['emittedFormCues']:
   points={str(j):r['landmarks'][j] for j in [11,12,13,14,15,16,23,24]} if len(r['landmarks'])>=25 else {}
   events.append({k:r[k] for k in ['frameNumber','timestampMs','selectedSide','leftAngle','rightAngle','repEvents','emittedFormCues']}|dict(clip_id=cid,landmarks=points))
 # Cue adjudication is direct visual review of original video around emitted events.
 cue_review=({'false':1,'true':0,'unassessable':0,'evidence':'Original pixels at 5.6,5.9,6.2,6.5,6.8 s show upright torso, no corresponding lateral torso collapse/swing. Replay hip is near shoulder with visibility 1.0.'} if cid=='c01' else
 {'false':0,'true':0,'unassessable':2,'evidence':'Moving oblique camera and covered hips prevent independent excessive-swing adjudication at 5.2 and 6.0 s.'} if cid=='c12' else
 {'false':0,'true':0,'unassessable':0,'evidence':'No emitted form cue events in this replay.'})
 total=cue_review['false']+cue_review['true'];cue_review['false_fraction_among_adjudicated']=cue_review['false']/total if total else None
 cue_review['whole_clip_false_fraction']=cue_review['false']/summary['formCueEvents'] if summary['formCueEvents'] and not cue_review['unassessable'] else None
 result.append(dict(clip_id=cid,file=Path(label['file']).name,exercise=label['exercise_guess'],split=label['split'],label_confidence=label['label_confidence'],label_status='PROVISIONAL / UNREVIEWED',reference_full=label['full_reps'],reference_partial=label['partial_reps'],**summary,
  any_working_arm_incomplete_frames=sum(r['leftAngle'] is None or r['rightAngle'] is None for r in frames),no_selected_pose_frames=sum(not r['landmarks'] for r in frames),
  latency_thirds=thirds,latency_p95_last_minus_first_ms=thirds[2]['p95']-thirds[0]['p95'],first_frame_inference_ms=frames[0]['inferenceMs'],cue_review=cue_review,configuration=cfg,provenance=prov))
out=repo/'patches';(out/'provisional-baseline.json').write_text(json.dumps({'status':'CURRENT-code screen-recording proxy; all label errors provisional and unreviewed','manifest_sha256':frozen['manifest_sha256'],'records':result,'excluded_or_low':[dict(clip_id=r['clip_id'],file=Path(r['file']).name,confidence=r['label_confidence'],split=r['split'],reason=r.get('exclusion_reason','Two visual passes disagree')) for r in labels if r['exclude_from_baseline']]},indent=2))
(out/'baseline-event-evidence.json').write_text(json.dumps(events,indent=2));(out/'baseline-latency-windows.json').write_text(json.dumps(windows,indent=2))
with (out/'baseline-table.csv').open('w',newline='') as f:
 keys=['clip_id','file','split','label_confidence','reference_full','reference_partial','fullRepsDetected','partialRepsDetected','fullCountError','partialCountError','processedFrames','missingWorkingTripletFrames','any_working_arm_incomplete_frames','inferenceP95Ms','latency_p95_last_minus_first_ms','formCueEvents'];w=csv.DictWriter(f,keys,extrasaction='ignore');w.writeheader();w.writerows(result)
for r in result:print(r['clip_id'],r['split'],r['label_confidence'],f"counts {r['fullRepsDetected']}/{r['partialRepsDetected']} vs {r['reference_full']}/{r['reference_partial']}",f"missing {r['missingWorkingTripletFrames']}/{r['processedFrames']}; any {r['any_working_arm_incomplete_frames']}",f"p95 {r['inferenceP95Ms']:.2f}; thirds "+str([round(t['p95'],2) for t in r['latency_thirds']]))
