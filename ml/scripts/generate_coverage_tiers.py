#!/usr/bin/env python3
"""Generate conservative tiers; a name-based rule is not validation evidence."""
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[2]
catalog = json.loads((root / 'ml/data/exercise_ml_map.json').read_text(encoding='utf-8'))
report = json.loads((root / 'ml/reports/repcount/FINAL_REPORT.json').read_text(encoding='utf-8'))
beta = {'6YUfHPL': 'squat', 'I4hDWkc': 'push_up', 'lBDjFxJ': 'pull_up', '3eGE2JC': 'front_raise', '1g5bPpA': 'jumping_jack'}

def classify(name):
    name = name.lower()
    # A plank with an action is a repetition, not a static hold.
    dynamic = ('dead bug', 'rollout', 'roll out', 'sledge hammer', 'sledgehammer', 'slam', 'windshield wiper', 'leg raise', 'twist', 'pallof press', 'tap', 'raise', 'lift', 'abduction', 'fly', 'push-up to', 'push up to', 'walk', 'jack', 'climber', 'rotation', 'rock', 'crawl', 'dip')
    if any(word in name for word in dynamic):
        if any(word in name for word in ('lying', 'floor', 'dead bug', 'windshield', 'leg raise')):
            return 'pose_unreliable', 'rule', 'Dynamic movement; floor position or occlusion may make pose estimation unreliable.'
        return 'candidate_unvalidated', 'unmeasured', 'Dynamic movement; repetition counting has not been validated.'
    if re.search(r'\b(plank|wall sit|hollow hold|isometric hold)\b', name):
        return 'hold_timer', 'rule', 'Static hold; use a timer rather than repetition counting.'
    if any(word in name for word in ('stretch', 'yoga', 'mobility')):
        return 'no_reps', 'rule', 'Mobility or stretching movement; repetition counting is not assigned.'
    if any(word in name for word in ('bench', 'lying', 'floor', 'bridge', 'crunch')):
        return 'pose_unreliable', 'rule', 'Floor position or occlusion may make pose estimation unreliable.'
    return 'candidate_unvalidated', 'unmeasured', 'No representative validation or range-of-motion measurement available.'

tiers = {}
for exercise_id, exercise in catalog.items():
    classification, source, reason = classify(exercise.get('name', ''))
    entry = {'classification': classification, 'tier_source': source, 'reason': reason,
             'tier': 'pose_only' if classification == 'pose_unreliable' else 'manual'}
    if exercise_id in beta:
        stats = report['per_class'][beta[exercise_id]]['pooled']
        entry.update(classification='beta_family', tier_source='measured', tier='auto_count_beta',
                     reason='Measured on RepCount-A; beta only, not verified.', pooled_n=str(stats['n']), pooled_within1_pct=str(stats['within1_pct']))
    tiers[exercise_id] = entry
(root / 'ml/models/catalog_tiers.json').write_text(json.dumps(tiers, indent=2) + '\n', encoding='utf-8')
print(f'Generated {len(tiers)} catalog tiers. No low-ROM measurements were supplied; low_rom source count is zero.')
