#!/usr/bin/env python3
"""
Generate strict catalog tiers in accordance with K1-K3 requirements:
- Beta = strictly RepCount-A tested ids: 6YUfHPL (squat), I4hDWkc (push-up), lBDjFxJ (pull-up), 3eGE2JC (front raise), 1g5bPpA (jumping jack)
- Candidate = everything else
- Pose Unreliable = lying / bench / floor / bridge / crunch / plank / raise
- No Reps / Yoga = stretch / yoga / mobility
"""
import json, csv
from pathlib import Path
from collections import Counter

ML = Path(__file__).resolve().parents[1]
DATA = ML / 'data'
OUT = ML / 'reports' / 'coverage'
OUT.mkdir(parents=True, exist_ok=True)

with open(DATA / 'exercise_ml_map.json', encoding='utf-8') as f:
    catalog = json.load(f)

BETA_IDS = {'6YUfHPL', 'I4hDWkc', 'lBDjFxJ', '3eGE2JC', '1g5bPpA'}
BETA_STATS = {
    '6YUfHPL': {'n': '34', 'within1': '52.9'},
    'I4hDWkc': {'n': '34', 'within1': '50.0'},
    'lBDjFxJ': {'n': '33', 'within1': '66.7'},
    '3eGE2JC': {'n': '37', 'within1': '51.4'},
    '1g5bPpA': {'n': '41', 'within1': '41.5'}
}

tier_map = {}
rows = []
tier_counts = Counter()

for ex_id, ex in catalog.items():
    name = ex.get('name', '').lower()
    equip = ex.get('equipments', [])
    body_parts = ex.get('bodyParts', [])

    if 'stretch' in name or 'yoga' in name or 'mobility' in name:
        tier = 'no_reps'
        tracking_tier = 'manual'
    elif ex_id in BETA_IDS:
        tier = 'beta_family'
        tracking_tier = 'auto_count_beta'
    elif any(i in name for i in ['bench', 'lying', 'floor', 'bridge', 'crunch', 'plank', 'raise']) or 'floor' in body_parts:
        tier = 'pose_unreliable'
        tracking_tier = 'pose_only'
    else:
        tier = 'candidate_unvalidated'
        tracking_tier = 'manual'

    tier_counts[tier] += 1
    stats = BETA_STATS.get(ex_id, {})

    tier_map[ex_id] = {
        'tier': tracking_tier,
        'pooled_n': stats.get('n', ''),
        'pooled_within1_pct': stats.get('within1', '')
    }

    rows.append({
        'exerciseId': ex_id,
        'name': ex.get('name', ''),
        'tier': tier,
        'trackingTier': tracking_tier,
        'pooled_n': stats.get('n', ''),
        'pooled_within1_pct': stats.get('within1', '')
    })

with open(OUT / 'catalog_tiers.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=['exerciseId', 'name', 'tier', 'trackingTier', 'pooled_n', 'pooled_within1_pct'])
    writer.writeheader()
    writer.writerows(rows)

with open(ML / 'models' / 'catalog_tiers.json', 'w', encoding='utf-8') as f:
    json.dump(tier_map, f, indent=1)

print("Strict K1 tier counts:", dict(tier_counts))
