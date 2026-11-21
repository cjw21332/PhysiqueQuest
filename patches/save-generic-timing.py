from pathlib import Path
import difflib

p = Path('shared/genericRepCounter.ts')
after = p.read_text(encoding='utf8')
before = after.replace("  | { type: 'rep_rejected'; joint: string; reason: 'timing_failed'; durationMs: number }\n", '')
new = """          } else if (duration < this.config.minRepDurationMs || duration > this.config.maxRepDurationMs) {
            this.emitEvent({ type: 'rep_rejected', joint, reason: 'timing_failed', durationMs: duration });
"""
old = """          } else if (this.maxProgressInRep > 0.4) {
            // Rep completed but was too fast/slow - treat as partial
            this.partialCount++;
            this.emitEvent({
              type: 'rep_partial',
              progress: this.maxProgressInRep,
              joint,
              cue: this.getPartialCue(joint, this.maxProgressInRep)
            });
"""
assert before.count(new) == 1
before = before.replace(new, old)
diff = difflib.unified_diff(before.splitlines(keepends=True), after.splitlines(keepends=True), fromfile='a/shared/genericRepCounter.ts', tofile='b/shared/genericRepCounter.ts')
Path('patches/0010-generic-timing-candidate.patch').write_text(''.join(diff), encoding='utf8', newline='\n')
Path('output/pose-replay-private/generic-intermediate.ts').write_text(before,encoding='utf8',newline='\n')
