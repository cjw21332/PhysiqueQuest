from pathlib import Path
import difflib

engine = Path('shared/exerciseEngine.ts')
tests = Path('shared/__tests__/exerciseEngine.spec.ts')
old_engine = Path('output/pose-replay-private/priority1-original/shared/exerciseEngine.ts').read_text(encoding='utf8')
new_tests = tests.read_text(encoding='utf8')
added = """  it('rejects a peak-reaching cycle that is too fast without counting a partial', () => {
    const counter = createExerciseCounter('squat');
    let result = counter.snapshot();
    for (const [index, angle] of [172, 150, 110, 95, 95, 140, 172].entries()) result = counter.update(frame('squat', angle, index * 20));
    expect(result.rejection).toBe('timing_failed');
    expect(result.reps).toBe(0);
    expect(result.partials).toBe(0);
  });
"""
assert new_tests.count(added) == 1
parts=[]
for path, before, after in [(engine,old_engine,engine.read_text(encoding='utf8')),(tests,new_tests.replace(added,''),new_tests)]:
    parts.extend(difflib.unified_diff(before.splitlines(keepends=True),after.splitlines(keepends=True),fromfile='a/'+path.as_posix(),tofile='b/'+path.as_posix()))
Path('patches/0012-timing-rejection.patch').write_text(''.join(parts),encoding='utf8',newline='\n')
