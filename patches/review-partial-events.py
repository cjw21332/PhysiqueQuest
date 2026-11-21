"""Extract baseline event diagnostics and video-only review sheets; no inference."""
import csv, json, math
from pathlib import Path
import cv2
from PIL import Image, ImageDraw

root = Path('output/pose-replay-private/provisional-baseline-2026-11-21')
out = Path('output/pose-replay-private/partial-event-review')
out.mkdir(parents=True, exist_ok=True)
labels = {x['clip_id']: x for x in json.loads(Path('patches/labels.local.json').read_text(encoding='utf-8'))}
records = []
for cid in ('c01', 'c06', 'c15', 'c17', 'c04', 'c12', 'c14'):
    config = json.loads((root/cid/'configuration.json').read_text(encoding='utf-8'))['spec']
    frames = [json.loads(line) for line in (root/cid/'frames.jsonl').read_text(encoding='utf-8').splitlines()]
    cap = cv2.VideoCapture(labels[cid]['file'])
    for index, frame in enumerate(frames):
        for event in (x for x in frame['repEvents'] if x['type'] == 'partial'):
            prev = frames[index-1]
            candidates = []
            for side in ('left','right'):
                before = prev['sideStates'][side]
                after = frame['sideStates'][side]
                if before['repStartAt'] and not after['repStartAt']:
                    candidates.append(side)
            if len(candidates) != 1:
                records.append({'clip':cid,'timestamp_s':frame['timestampMs']/1000,'side':'ambiguous','note':str(candidates)})
                continue
            side = candidates[0]
            state = prev['sideStates'][side]
            start = state['repStartAt']
            cycle = [f for f in frames[:index+1] if start <= f['timestampMs'] <= frame['timestampMs'] and f[side+'Angle'] is not None]
            vals = [f[side+'Angle'] for f in cycle]
            # Include the arm's pre-departure angle held in the counter's extrema.
            current = frame[side+'Angle']
            low = min(state['minAngle'], current) if current is not None else state['minAngle']
            high = max(state['maxAngle'], current) if current is not None else state['maxAngle']
            direction = 1 if config['peakAngle'] > config['startAngle'] else -1
            peak = max(cycle, key=lambda f: direction*f[side+'Angle']) if cycle else None
            duration = frame['timestampMs']-start
            peak_return = frame['timestampMs']-peak['timestampMs'] if peak else None
            stem = f"{cid}-{frame['frameNumber']:04d}"
            t = frame['timestampMs']/1000
            # 2 seconds before and 0.5 after event at 5 fps, individual tiles labeled.
            times = [max(0,t-2+i*.2) for i in range(13)]
            sheet = Image.new('RGB',(1400,3*340),'black'); draw = ImageDraw.Draw(sheet)
            for i, at in enumerate(times):
                cap.set(cv2.CAP_PROP_POS_MSEC, at*1000); ok, bgr = cap.read()
                if ok:
                    im = Image.fromarray(cv2.cvtColor(bgr,cv2.COLOR_BGR2RGB)); im.thumbnail((275,305))
                    x,y=(i%5)*280,(i//5)*340
                    sheet.paste(im,(x,y+25)); draw.text((x+4,y+3),f'{at:.2f} s',fill='white')
            image = out/(stem+'.jpg'); sheet.save(image,quality=86)
            records.append({'clip':cid,'split':labels[cid]['split'],'frame':frame['frameNumber'],'timestamp_s':t,
                'side':side,'range_pct':round(100*(high-low)/abs(config['peakAngle']-config['startAngle']),1),
                'duration_ms':duration,'peak_to_return_ms':peak_return,'range_deg':round(high-low,1),
                'cycle_start_ms':start,'peak_sample_ms':peak['timestampMs'] if peak else None,
                'evidence_image':str(image),'note':'Angle extrema are counter estimates, not visually measured movement.'})
    cap.release()
Path('patches/partial-event-diagnostics.json').write_text(json.dumps(records,indent=2),encoding='utf-8')
print(json.dumps(records,indent=2))
