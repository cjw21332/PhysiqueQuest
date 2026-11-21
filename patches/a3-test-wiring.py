from pathlib import Path
p=Path('mobile/camera-readiness.test.mjs');s=p.read_text(encoding='utf8')
s=s.replace("const shared=compile('shared/cameraReadiness.ts');","const shared=compile('shared/cameraReadiness.ts');\nconst recoveryModule=compile('shared/cameraRecovery.ts');")
s=s.replace("'../../shared/cameraReadiness':shared}","'../../shared/cameraReadiness':shared,'../../shared/cameraRecovery':recoveryModule}")
s=s.replace('function streamHarness(acquire) {','function streamHarness(acquire, recover=false) {')
s=s.replace('const render=()=>h.render(module.useCameraStream,context);','const render=()=>h.render(props=>module.useCameraStream(props,recover),context);',1)
p.write_text(s,encoding='utf8')
