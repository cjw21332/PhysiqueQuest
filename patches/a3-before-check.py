from pathlib import Path
import subprocess
cases=[('frontend/hooks/useCameraStream.ts','recovering live camera resumes'),('mobile/PoseTrackerNative.tsx','native parent rejects an old retry'),('mobile/App.tsx','native host executes bounded')]
for name,pattern in cases:
    p=Path(name);current=p.read_bytes()
    try:
        p.write_bytes((Path('output/a3-before')/name).read_bytes())
        r=subprocess.run(['node','--test','--test-name-pattern',pattern,'mobile/camera-readiness.test.mjs'],capture_output=True,encoding='utf8',errors='replace')
        log=Path('patches')/('a3-before-'+p.stem+'.log');log.write_text(r.stdout+r.stderr,encoding='utf8')
        print(name,'before-fix exit',r.returncode)
    finally:p.write_bytes(current)
