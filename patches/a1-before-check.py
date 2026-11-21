from pathlib import Path
import subprocess
p=Path('frontend/sections/Coach/PoseTrackerSession.tsx')
current=p.read_bytes()
try:
    p.write_bytes(Path('output/a1-before/frontend/sections/Coach/PoseTrackerSession.tsx').read_bytes())
    result=subprocess.run(['cmd','/c','npx','vitest','run','shared/__tests__/trackingAvailability.spec.ts'],capture_output=True,text=True,encoding='utf8',errors='replace')
    Path('patches/a1-before-test.log').write_text(result.stdout+result.stderr,encoding='utf8')
    print('Before UI test exit:',result.returncode)
    print(result.stdout[-1800:]+result.stderr[-1200:])
finally:
    p.write_bytes(current)
