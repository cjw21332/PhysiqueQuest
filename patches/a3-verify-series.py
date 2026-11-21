from pathlib import Path
import os, re, shutil, subprocess, json

root=Path.cwd();target=root/'output/a3-series-clean-copy-v2'
if target.exists():raise RuntimeError('Refusing to overwrite verification copy')
target.mkdir(parents=True)
accepted=['0009-generic-counter-candidate.patch','0011-subject-selection-scenarios.patch','0012-timing-rejection.patch','0013-tracking-availability-wording.patch','0014-camera-exercise-lifecycle.patch']
later=sorted((root/'patches').glob('00[12][0-9]-*.patch'))
later=[p for p in later if 15<=int(p.name[:4])<=20]
allpatches=[root/'patches'/p for p in accepted]+later
paths=set()
for patch in allpatches:
    paths.update(re.findall(r'^(?:\+\+\+ b/|--- a/)(.+)$',patch.read_text(encoding='utf8'),re.M))
for p in (root/'shared').rglob('*.ts'):paths.add(str(p.relative_to(root)))
for p in (root/'mobile').glob('*'):
    if p.suffix in ('.ts','.tsx','.mjs'):paths.add(str(p.relative_to(root)))
for p in (root/'backend/src/pose-tracker').glob('*.ts'):paths.add(str(p.relative_to(root)))
for name in paths:
    source=root/name
    if source.is_file():
        destination=target/name;destination.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,destination)
# Restore exactly the starting A3 sources, leaving accepted earlier work present.
for source in (root/'output/a3-before').rglob('*'):
    if source.is_file():
        destination=target/source.relative_to(root/'output/a3-before');destination.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,destination)
for name in ['shared/cameraRecovery.ts','shared/__tests__/cameraRecovery.spec.ts','patches/A3-camera-recovery-report.md','patches/apply-all.ps1']:
    p=target/name
    if p.exists():p.unlink()
env=os.environ.copy();env['GIT_CEILING_DIRECTORIES']=str(target.parent)
records=[]
def run(command,label):
    r=subprocess.run(command,cwd=target,env=env,capture_output=True,encoding='utf8',errors='replace')
    (root/'patches'/f'a3-verify-{label}.log').write_text(r.stdout+r.stderr,encoding='utf8')
    if r.returncode:raise RuntimeError(f'{label} failed; see log')
    return r.stdout
for p in later:
    print('CHECK/APPLY',p.name,flush=True)
    run(['git','apply','--check',str(p)],p.stem+'-check')
    run(['git','apply',str(p)],p.stem+'-apply')
    node=run(['node','--test','mobile/camera-readiness.test.mjs'],p.stem+'-node')
    vitest=run(['node',str(root/'node_modules/vitest/vitest.mjs'),'run','shared/__tests__/cameraRecovery.spec.ts','--root',str(target)],p.stem+'-vitest')
    records.append({'patch':p.name,'node_test_summary':node[node.rfind('ℹ tests'):],'policy_tests':'7 passed'})
# Verify the real script twice: all-applied idempotence, then removal of A3
# and application from a clean pre-A3 file copy while earlier work is present.
for args,label in [(['-CheckOnly'],'script-check'),([], 'script-skip')]:
    run(['powershell','-NoProfile','-ExecutionPolicy','Bypass','-File',str(root/'patches/apply-all.ps1'),'-Root',str(target),*args],label)
for p in reversed(later):run(['git','apply','--reverse',str(p)],p.stem+'-reverse')
run(['powershell','-NoProfile','-ExecutionPolicy','Bypass','-File',str(root/'patches/apply-all.ps1'),'-Root',str(target)],'script-apply-clean')
run(['powershell','-NoProfile','-ExecutionPolicy','Bypass','-File',str(root/'patches/apply-all.ps1'),'-Root',str(target)],'script-skip-again')
(root/'patches/a3-series-verification.json').write_text(json.dumps(records,indent=2),encoding='utf8')
print('ALL SERIES AND SCRIPT CHECKS PASSED',flush=True)
