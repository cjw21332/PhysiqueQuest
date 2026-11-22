from pathlib import Path
p=Path('frontend/sections/Coach/PoseTrackerSession.tsx')
s=p.read_text(encoding='utf8')
s=s.replace("'Camera tracking is not ready for this exercise. You can still log it manually.'",'unsupportedTrackingMessage')
s=s.replace('<p className="pose-setup-help">','{allowed && <p className="pose-setup-help">')
s=s.replace("This tracking option requires an internet connection.'}</p>","This tracking option requires an internet connection.'}</p>}")
p.write_text(s,encoding='utf8')
