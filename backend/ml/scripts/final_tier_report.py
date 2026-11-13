import json
from pathlib import Path
from collections import Counter, defaultdict

ML = Path('../ml')
CATALOG = ML / 'data' / 'exercise_ml_map.json'

catalog = json.load(open(CATALOG, encoding='utf-8'))

def get_tier(ex):
    name = ex.get('name', '').lower()
    if 'stretch' in name or 'yoga' in name or 'mobility' in name: return 'no_reps', 'rule'
    if ex.get('rep_signal', {}).get('is_isometric'): return 'hold_timer', 'rule'
    lying = {'floor', 'lying', 'bench', 'bridge', 'crunch', 'plank', 'leg raise'}
    if any(i in name for i in lying) or 'floor' in ex.get('bodyParts', []): return 'pose_unreliable', 'rule'
    beta_ids = ['6YUfHPL', 'I4hDWkc', 'lBDjFxJ', '3eGE2JC', '1g5bPpA']
    if ex.get('exerciseId') in beta_ids: return 'beta_family', 'measured'
    return 'candidate_unvalidated', 'rule'

tier_counts = Counter()
source_counts = Counter()
examples = defaultdict(list)

for ex_id, ex in catalog.items():
    tier, source = get_tier(ex)
    tier_counts[tier] += 1
    source_counts[source] += 1
    if len(examples[tier]) < 20:
        examples[tier].append(f"{ex_id}, {ex.get('name', 'n/a')}, {ex.get('equipments', ['n/a'])[0]}, {ex.get('movement_pattern', 'n/a')}")

print("--- TIER COUNTS ---")
for t, c in tier_counts.items(): print(f"{t}: {c}")
print("\n--- SOURCE COUNTS ---")
for s, c in source_counts.items(): print(f"{s}: {c}")
print("\n--- RANDOM EXAMPLES ---")
for t, ex in examples.items():
    print(f"\n{t}:")
    for e in ex: print(f"  {e}")
