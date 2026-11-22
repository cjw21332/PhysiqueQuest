from pathlib import Path
for name in ['LiveSession','TrackingSession','SquatFormPreview']:
    p=Path(f'frontend/sections/Coach/{name}.tsx');s=p.read_text(encoding='utf8')
    s=s.replace(": 'Enable camera'",": camera.recoveryState.phase === 'failed' ? 'Try again' : 'Enable camera'")
    p.write_text(s,encoding='utf8')
