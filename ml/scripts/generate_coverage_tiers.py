#!/usr/bin/env python3
"""
H1: COVERAGE REPORT - Tier every exercise in the catalog
Rules for unmeasured tiers are rule-based, as requested.
"""

import json, csv, yaml
from pathlib import Path
from collections import Counter

ML = Path(__file__).resolve().parents[1]
DATA = ML / 'data'
OUT = ML / 'reports' / 'coverage'
OUT.mkdir(parents=True, exist_ok=True)

with open(DATA / 'exercise_ml_map.json', encoding='utf-8') as f:
    catalog = json.load(f)

# Rules for tiers
BETA_FAMILIES = {
    'pull_up': {'patterns': ['vertical_pull', 'horizontal_pull'], 'equipment': ['bodyweight', 'assisted']},
    'squat': {'patterns': ['squat', 'lunge'], 'equipment': ['bodyweight', 'dumbbell', 'barbell', 'weighted', 'kettlebell']},
    'push_up': {'patterns': ['horizontal_push', 'vertical_push', 'triceps_extension'], 'equipment': ['bodyweight', 'dumbbell', 'barbell', 'weighted']},
    'front_raise': {'patterns': ['front_raise', 'lateral_raise', 'rear_delt'], 'equipment': ['dumbbell', 'cable', 'resistance band', 'bodyweight']},
    'jumping_jack': {'patterns': ['cardio_dynamic'], 'equipment': ['bodyweight']},
}

def get_tier(ex):
    pattern = ex.get('movement_pattern', '')
    if ex.get('rep_signal', {}).get('is_isometric'): return 'hold_timer'
    if pattern in ['cardio_dynamic', 'carry_locomotion']: return 'no_reps'

    # Tightened pose_unreliable: Cable/Machine + Side view
    if any(e in ex.get('equipments', []) for e in ['cable', 'leverage machine', 'smith machine', 'sled machine']) and ex.get('camera_orientation') == 'side':
        return 'pose_unreliable'

    # Beta
    for fam, info in BETA_FAMILIES.items():
        if pattern in info['patterns'] and any(e in ex.get('equipments', []) for e in info['equipment']):
            return 'beta_family'

    # Fallback to candidate_unvalidated
    return 'candidate_unvalidated'

rows, tier_counts = [], Counter()
for ex_id, ex in catalog.items():
    tier = get_tier(ex)
    tier_counts[tier] += 1
    rows.append({
        'exerciseId': ex_id,
        'name': ex.get('name', ''),
        'tier': tier
    })

# Write outputs
with open(OUT / 'catalog_tiers.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=['exerciseId', 'name', 'tier'])
    writer.writeheader()
    writer.writerows(rows)

with open(ML / 'configs' / 'coverage_tiers.yaml', 'w', encoding='utf-8') as f:
    yaml.dump({'tiers': dict(tier_counts)}, f)

print(f"Counts: {dict(tier_counts)}")
