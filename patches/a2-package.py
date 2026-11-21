from pathlib import Path
import difflib
files=['frontend/hooks/useCameraStream.ts','mobile/camera-readiness.test.mjs','patches/PROGRESS.md','patches/A2-camera-lifecycle-audit.md']
diff=[]
for name in files:
    old=Path('output/a2-before')/name
    before=old.read_text(encoding='utf8').splitlines(keepends=True) if old.exists() else []
    after=Path(name).read_text(encoding='utf8').splitlines(keepends=True)
    diff.extend(difflib.unified_diff(before,after,fromfile='a/'+name if old.exists() else '/dev/null',tofile='b/'+name))
Path('patches/0014-camera-exercise-lifecycle.patch').write_text(''.join(diff),encoding='utf8',newline='\n')
