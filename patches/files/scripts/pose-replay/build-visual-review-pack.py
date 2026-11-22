"""Build three pixel-frame review anchors per clip; never generates labels."""
import json, html, zipfile
from pathlib import Path
import cv2
from PIL import Image, ImageDraw
repo=Path.cwd();rows=json.loads((repo/'patches/labels.local.json').read_text());out=repo/'output/pose-replay-private/spot-check-pack';out.mkdir(exist_ok=True)
page=['<!doctype html><meta charset="utf-8"><title>Provisional visual spot checks</title><style>body{font:16px system-ui;max-width:1100px;margin:auto;background:#151515;color:#eee}img{max-width:100%}article{margin:2em 0;border-top:1px solid #777}small{color:#bbb}</style><h1>PROVISIONAL / UNREVIEWED</h1><p>Three check moments per clip. For excluded clips these are blocked/setup intervals, not asserted reps. No counter or model output was used to create the labels. Opaque UI cannot be restored.</p>']
for r in rows:
 cid=r['clip_id'];times=r['spot_check_seconds'];c=cv2.VideoCapture(r['file']);sheet=Image.new('RGB',(864,676),'#111');draw=ImageDraw.Draw(sheet)
 for i,t in enumerate(times):
  c.set(cv2.CAP_PROP_POS_MSEC,t*1000);ok,f=c.read()
  if not ok:raise RuntimeError(f'Cannot read {cid} {t}')
  im=Image.fromarray(cv2.cvtColor(f,cv2.COLOR_BGR2RGB)).resize((288,640));mask=ImageDraw.Draw(im);mask.rectangle((int(.2*288),int(.145*640),int(.81*288),int(.246*640)),fill='black');sheet.paste(im,(i*288,0));draw.text((i*288+5,646),f'{cid} {t:.2f}s',fill='white')
 c.release();sheet.save(out/(cid+'.jpg'),quality=88)
 page.append('<article><h2>'+html.escape(cid+' '+Path(r['file']).name)+'</h2><p>'+html.escape(f"{r['split']} | {r['label_confidence']} | full/partial {r['full_reps']}/{r['partial_reps']}")+'</p><img src="'+cid+'.jpg"><p>'+html.escape(r.get('exclusion_reason',r['notes']))+'</p></article>')
(out/'index.html').write_text('\n'.join(page),encoding='utf-8')
with zipfile.ZipFile(repo/'patches/visual-spot-check-pack.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in out.iterdir():z.write(p,p.name)
 z.write(repo/'patches/labels.local.json','labels.local.json');z.write(repo/'patches/visual-spot-checks.md','visual-spot-checks.md')
print(repo/'patches/visual-spot-check-pack.zip')
