from pathlib import Path
import difflib
old=Path('output/pose-replay-private/generic-before.ts')
target=Path('shared/genericRepCounter.ts')
diff=difflib.unified_diff(old.read_text(encoding='utf8').splitlines(keepends=True),target.read_text(encoding='utf8').splitlines(keepends=True),fromfile='a/shared/genericRepCounter.ts',tofile='b/shared/genericRepCounter.ts')
Path('patches/0009-generic-counter-candidate.patch').write_text(''.join(diff),encoding='utf8',newline='\n')
target.write_bytes(old.read_bytes())
