import json
from pathlib import Path
from collections import Counter, defaultdict

ML = Path('ml')
CATALOG = ML / 'data' / 'exercise_ml_map.json'
catalog = json.load(open(CATALOG, encoding='utf-8'))

tier_counts = Counter()
tier_source_counts = defaultdict(lambda: Counter())
examples = defaultdict(list)
beta_ids = ['6YUfHPL', 'I4hDWkc', 'lBDjFxJ', '3eGE2JC', '1g5bPpA']

for ex_id, ex in catalog.items():
    name = ex.get('name', '').lower()
    if ex_id in beta_ids:
        tier = 'beta_family'
        source = 'measured'
    elif 'stretch' in name or 'yoga' in name or 'mobility' in name:
        tier = 'no_reps'
        source = 'rule'
    elif ex.get('rep_signal', {}).get('is_isometric'):
        tier = 'hold_timer'
        source = 'rule'
    elif any(i in name for i in ['bench', 'lying', 'floor', 'bridge', 'crunch', 'plank', 'leg raise']):
        tier = 'pose_unreliable'
        source = 'rule'
    else:
        tier = 'candidate_unvalidated'
        source = 'rule'
    tier_counts[tier] += 1
    tier_source_counts[tier][source] += 1
    if len(examples[tier]) < 20:
        examples[tier].append(f"{ex_id}, {ex.get('name')}, {tier}, {source}")

print("--- TIER x TIER_SOURCE TABLE ---")
for t, c in tier_counts.items():
    print(f"{t} (total={c}): {dict(tier_source_counts[t])}")
print("\n--- 20 RANDOM SAMPLES PER TIER ---")
for t, ex in examples.items():
    print(f"\n{t}:")
    for e in ex: print(f"  {e}")