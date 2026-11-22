from pathlib import Path
import difflib
base=Path('output/a3-before')
def before(name):
    p=base/name
    return p.read_text(encoding='utf8') if p.exists() else ''
def diff(name,old,new):
    return ''.join(difflib.unified_diff(old.splitlines(keepends=True),new.splitlines(keepends=True),fromfile='a/'+name if old else '/dev/null',tofile='b/'+name))
def write(number,label,files,custom=None):
    text=''
    for name in files:
        old,new=(custom[name] if custom and name in custom else (before(name),Path(name).read_text(encoding='utf8')))
        text+=diff(name,old,new)
    Path(f'patches/{number:04d}-{label}.patch').write_text(text,encoding='utf8',newline='\n')
test='mobile/camera-readiness.test.mjs'
old=before(test)
middle=old.replace("const shared=compile('shared/cameraReadiness.ts');","const shared=compile('shared/cameraReadiness.ts');\nconst recoveryModule=compile('shared/cameraRecovery.ts');").replace("'../../shared/cameraReadiness':shared}","'../../shared/cameraReadiness':shared,'../../shared/cameraRecovery':recoveryModule}")
write(15,'camera-recovery-state',['shared/cameraRecovery.ts','shared/__tests__/cameraRecovery.spec.ts'])
write(16,'browser-recovery',['frontend/hooks/useCameraStream.ts','frontend/sections/Coach/GenericTrackingSession.tsx','frontend/sections/Coach/LiveSession.tsx','frontend/sections/Coach/TrackingSession.tsx','frontend/sections/Coach/SquatFormPreview.tsx','frontend/hooks/useGenericRepTracking.ts',test],{test:(old,middle)})
write(17,'native-recovery',['mobile/PoseTrackerNative.tsx','mobile/NativeTrackingCamera.tsx'])
write(18,'host-message-recovery',['mobile/App.tsx'])
write(19,'recovery-integration-tests',[test],{test:(middle,Path(test).read_text(encoding='utf8'))})
write(20,'a3-evidence-and-apply',['patches/PROGRESS.md','patches/A3-camera-recovery-report.md','patches/apply-all.ps1'])
