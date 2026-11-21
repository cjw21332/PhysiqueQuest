"""Save only this turn's framing experiment, then restore pre-existing files."""
from pathlib import Path
import difflib

root = Path.cwd()
backup = root/'output/pose-replay-private/priority1-original'
existing = ['mobile/PoseTrackerNative.tsx', 'frontend/hooks/useGenericRepTracking.ts']
created = ['shared/framingGuard.ts', 'shared/__tests__/framingGuard.spec.ts']
diff = []
for name in existing + created:
    before = (backup/name).read_text(encoding='utf8').splitlines(keepends=True) if name in existing else []
    after = (root/name).read_text(encoding='utf8').splitlines(keepends=True)
    diff.extend(difflib.unified_diff(before, after, fromfile='a/'+name if name in existing else '/dev/null', tofile='b/'+name))
(root/'patches/priority1-framing-DRAFT.patch').write_text(''.join(diff),encoding='utf8',newline='\n')
for name in existing:
    (root/name).write_bytes((backup/name).read_bytes())
for name in created:
    (root/name).unlink()
print('Draft saved; pre-existing source files restored byte-for-byte.')
