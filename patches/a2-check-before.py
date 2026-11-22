from pathlib import Path
import subprocess
hook=Path('frontend/hooks/useCameraStream.ts')
current=hook.read_bytes()
try:
    hook.write_bytes(Path('output/a2-before/frontend/hooks/useCameraStream.ts').read_bytes())
    r=subprocess.run(['node','--test','mobile/camera-readiness.test.mjs'],capture_output=True,encoding='utf8',errors='replace')
    Path('patches/a2-before-test.log').write_text(r.stdout+r.stderr,encoding='utf8')
    print('pre-fix exit',r.returncode)
finally:
    hook.write_bytes(current)
