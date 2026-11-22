import argparse, json, hashlib, subprocess, importlib.util, math
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageDraw

p=argparse.ArgumentParser();p.add_argument('--clip',type=int);p.add_argument('--fps',type=float,default=6);p.add_argument('--offset',type=float,default=0);p.add_argument('--start',type=float,default=0);p.add_argument('--end',type=float);p.add_argument('--overview',action='store_true');args=p.parse_args()
root=Path.cwd();dest=root/'output/pose-replay-private/visual-labels';dest.mkdir(parents=True,exist_ok=True)
rows=json.loads((root/'patches/labels.local.json').read_text());unique=[];seen=set()
for row in rows:
 file=Path(row['file']);sha=hashlib.sha256(file.read_bytes()).hexdigest()
 if sha in seen:continue
 seen.add(sha);unique.append(row)
(dest/'unique-inventory.json').write_text(json.dumps([dict(row,visual_id=i+1) for i,row in enumerate(unique)],indent=2))
ffmpeg=next((Path(importlib.util.find_spec('imageio_ffmpeg').origin).parent/'binaries').glob('ffmpeg*.exe'))
def metadata(file):
 c=cv2.VideoCapture(str(file));w,h=int(c.get(3)),int(c.get(4));duration=c.get(7)/c.get(5);c.release();return w,h,duration
if args.overview:
 canvas=Image.new('RGB',(1000,2600),'#111');draw=ImageDraw.Draw(canvas)
 for i,row in enumerate(unique):
  file=Path(row['file']);w,h,d=metadata(file);t=min(d/2,8)
  raw=subprocess.check_output([str(ffmpeg),'-v','error','-ss',str(t),'-i',str(file),'-frames:v','1','-vf','scale=200:452','-f','rawvideo','-pix_fmt','rgb24','pipe:1'])
  im=Image.frombytes('RGB',(200,452),raw);x=(i%5)*200;y=(i//5)*650;canvas.paste(im,(x,y));draw.text((x+3,y+455),f'{i+1}: {d:.1f}s',fill='white')
  name=file.stem
  for k in range(0,len(name),23):draw.text((x+3,y+475+(k//23)*16),name[k:k+23],fill='white')
 canvas.save(dest/'overview.jpg',quality=92);print(dest/'overview.jpg')
else:
 row=unique[args.clip-1];file=Path(row['file']);w,h,d=metadata(file);start=args.start+args.offset;end=min(args.end or d,d)
 # Pixel-only decoding. No pose, counter, reference model or prediction is used.
 proc=subprocess.Popen([str(ffmpeg),'-v','error','-ss',str(start),'-i',str(file),'-t',str(end-start),'-vf',f'fps={args.fps},scale=144:326','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],stdout=subprocess.PIPE)
 page=0;count=0;sheet=None;draw=None;paths=[]
 while True:
  data=proc.stdout.read(144*326*3)
  if not data:break
  if len(data)!=144*326*3:raise RuntimeError('Truncated image')
  im=np.array(Image.frombytes('RGB',(144,326),data))
  # Blind the burned-in tracker UI. No reconstruction/inpainting is used.
  im[int(.145*326):int(.246*326),int(.20*144):int(.81*144)]=0
  red=(im[:,:,0]>120)&(im[:,:,0]>1.8*im[:,:,1])&(im[:,:,0]>1.8*im[:,:,2])
  rows_mask=np.flatnonzero(red.mean(axis=1)>.62)
  for yy in rows_mask:im[max(0,yy-2):min(326,yy+3)]=0
  colored=((im[:,:,1]>105)&(im[:,:,1]>1.25*im[:,:,0])&(im[:,:,1]>1.1*im[:,:,2]))|((im[:,:,0]>170)&(im[:,:,1]<90)&(im[:,:,2]<90))
  im[colored]=0
  cropped=Image.fromarray(im).crop((0,int(.13*326),144,int(.81*326))).resize((144,222))
  if count%80==0:
   if sheet:
    out=dest/f'c{args.clip:02d}_{args.fps:g}fps_o{args.offset:g}_{args.start:g}_{page:02d}.jpg';sheet.crop((0,0,1440,24+242*math.ceil((count%80 or 80)/10))).save(out,quality=94);paths.append(str(out))
   page+=1;sheet=Image.new('RGB',(1440,8*242+24),'#101010');draw=ImageDraw.Draw(sheet);draw.text((5,2),f'BLINDED | {file.name} | {args.fps}fps | offset {args.offset}',fill='white')
  x=(count%10)*144;y=((count%80)//10)*242+24;sheet.paste(cropped,(x,y));draw.text((x+2,y+222),f'{start+count/args.fps:.2f}s',fill='white');count+=1
 if sheet:
  out=dest/f'c{args.clip:02d}_{args.fps:g}fps_o{args.offset:g}_{args.start:g}_{page:02d}.jpg';sheet.crop((0,0,1440,24+242*math.ceil((count%80 or 80)/10))).save(out,quality=94);paths.append(str(out))
 code=proc.wait()
 if code:raise RuntimeError(f'ffmpeg {code}')
 print(json.dumps({'clip':args.clip,'frames':count,'paths':paths}))
