from pathlib import Path
import difflib
files=['frontend/sections/Coach/PoseTrackerSession.tsx','backend/src/pose-tracker/exercise-registry.ts','patches/PROGRESS.md','shared/__tests__/trackingAvailability.spec.ts']
parts=[]
for name in files:
    prior=Path('output/a1-before')/name
    before=prior.read_text(encoding='utf8').splitlines(keepends=True) if prior.exists() else []
    after=Path(name).read_text(encoding='utf8').splitlines(keepends=True)
    parts.extend(difflib.unified_diff(before,after,fromfile='a/'+name if prior.exists() else '/dev/null',tofile='b/'+name))
Path('patches/0013-tracking-availability-wording.patch').write_text(''.join(parts),encoding='utf8',newline='\n')
