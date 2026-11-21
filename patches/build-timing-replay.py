from pathlib import Path
s = Path('patches/replay-development-candidate.py').read_text(encoding='utf8')
s = s.replace("f'output/pose-replay-private/provisional-baseline-2026-11-21/{cid}/frames.jsonl'", "f'output/pose-replay-private/{cid}-15hz-development/frames.jsonl'")
s = s.replace('development-mapping-diagnostic.json', 'development-timing-15hz.json')
s = s.replace("r['snapshot'].get('rejected',[])", "([{'reason':r['snapshot']['rejection']}] if r['snapshot'].get('rejection') else [])")
Path('patches/replay-timing-15hz.py').write_text(s,encoding='utf8')
