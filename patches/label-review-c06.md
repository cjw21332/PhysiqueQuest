# c06 label review — provisional, unreviewed

Proposed disposition: **exclude this clip from full/partial accuracy scoring**, pending an unaugmented camera recording or an independently blinded visual review. Do not alter `labels.local.json`.

A third extraction was made from the local recording at 6 frames/s with a 0.041667-second offset. The resulting contact sheets are in `output/pose-replay-private/c06-third-*.jpg`. They reveal that the source is a screen recording with tracker counts, guidance, an opaque countdown and skeleton already burned into the image; the new sheets did not successfully mask these. Thus this pass was not independent of the system's visible output and cannot justify correcting the existing one-full-rep label. Arm positions and the shared-handle linkage are also partly obscured. No count from this contaminated pass should be used as a label.

Command: `rtk proxy python -c "import subprocess,sysconfig,pathlib; ff=pathlib.Path(sysconfig.get_paths()['purelib'])/'imageio_ffmpeg/binaries/ffmpeg-win64-v4.2.2.exe'; v=pathlib.Path.home()/'Downloads/PhysiqueQuest testing/machine preacher curl.mp4'; out=pathlib.Path('output/pose-replay-private/c06-third-%02d.jpg'); c=[str(ff),'-hide_banner','-loglevel','error','-ss','0.041667','-i',str(v),'-vf','fps=6,scale=150:-1,tile=8x8','-q:v','3','-y',str(out)]; r=subprocess.run(c); print('exit',r.returncode)"` (exit 0).
