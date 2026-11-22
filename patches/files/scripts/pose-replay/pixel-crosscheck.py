"""Independent pixel-motion cross-check only. NEVER writes or derives labels.

Hand/handle-region frame-difference bursts are not anatomical ROM evidence.
Half the burst count is a deliberately simple comparison, not a rep counter.
"""
import json, csv, subprocess, importlib.util, math
from pathlib import Path
import numpy as np
import cv2
repo=Path.cwd(); labels=json.loads((repo/'patches/labels.local.json').read_text())
ffmpeg=next((Path(importlib.util.find_spec('imageio_ffmpeg').origin).parent/'binaries').glob('ffmpeg*.exe'))
out=repo/'output/pose-replay-private/pixel-crosscheck';out.mkdir(exist_ok=True)
# Normalized pixel regions selected from images, not a pose model.
rois={'c01':(.24,.25,.76,.43),'c04':(.2,.31,.8,.47),'c06':(.06,.29,.58,.44),'c12':(.15,.25,.86,.43),'c14':(.02,.27,.8,.45),'c15':(.15,.25,.85,.48),'c17':(.05,.46,.98,.74)}
report=[]
for r in labels:
 if r['clip_id'] not in rois:continue
 fps=r['visual_sampling_fps']; w,h=184,416;cmd=[str(ffmpeg),'-v','error','-i',r['file'],'-vf',f'fps={fps},scale={w}:{h}','-f','rawvideo','-pix_fmt','rgb24','pipe:1']
 proc=subprocess.Popen(cmd,stdout=subprocess.PIPE);prev=None;signal=[];x1,y1,x2,y2=rois[r['clip_id']]
 while True:
  b=proc.stdout.read(w*h*3)
  if not b:break
  if len(b)!=w*h*3:raise RuntimeError('Short RGB frame')
  im=np.frombuffer(b,np.uint8).reshape(h,w,3).copy(); red=(im[:,:,0]>120)&(im[:,:,0]>1.8*im[:,:,1])&(im[:,:,0]>1.8*im[:,:,2]);green=(im[:,:,1]>105)&(im[:,:,1]>1.25*im[:,:,0])&(im[:,:,1]>1.1*im[:,:,2]);im[red|green]=0
  im=im[int(y1*h):int(y2*h),int(x1*w):int(x2*w)];gray=cv2.cvtColor(im,cv2.COLOR_RGB2GRAY).astype(float)
  signal.append(0 if prev is None else float(np.abs(gray-prev).mean()));prev=gray
 if proc.wait():raise RuntimeError('ffmpeg failed')
 a=np.array(signal);threshold=float(np.median(a)+np.median(np.abs(a-np.median(a))));peaks=[]
 for k in range(1,len(a)-1):
  if a[k]>threshold and a[k]>a[k-1] and a[k]>=a[k+1]:
   if not peaks or k-peaks[-1]>=max(1,round(.4*fps)):peaks.append(k)
   elif a[k]>a[peaks[-1]]:peaks[-1]=k
 with (out/(r['clip_id']+'.csv')).open('w',newline='') as f:
  wr=csv.writer(f);wr.writerow(['seconds','roi_mean_absolute_pixel_difference','burst_peak'])
  wr.writerows((k/fps,v,k in peaks) for k,v in enumerate(signal))
 estimate=len(peaks)//2;visual=r['full_reps']+r['partial_reps']
 report.append({'clip_id':r['clip_id'],'fps':fps,'pixel_roi':rois[r['clip_id']],'burst_times_s':[round(k/fps,3) for k in peaks],'half_burst_comparison':estimate,'visual_complete_cycles':visual,'disagrees':estimate!=visual,'labels_changed':False,'note':'Non-anatomical cross-check only; camera movement, baked UI changes and held/incomplete endpoints confound burst pairing. Agreement does not establish ROM or accuracy.'})
(out/'summary.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=1))
