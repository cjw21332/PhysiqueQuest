#!/usr/bin/env python3
"""Report the generated catalog, with reproducible random examples."""
import json
import random
from collections import Counter, defaultdict
from pathlib import Path

root = Path(__file__).resolve().parents[2]
catalog = json.loads((root / 'ml/data/exercise_ml_map.json').read_text(encoding='utf-8'))
tiers = json.loads((root / 'ml/models/catalog_tiers.json').read_text(encoding='utf-8'))
counts = defaultdict(Counter)
samples = defaultdict(list)
for exercise_id, entry in tiers.items():
    counts[entry['classification']][entry['tier_source']] += 1
    samples[entry['classification']].append((exercise_id, catalog[exercise_id]['name'], entry['classification'], entry['tier_source']))
print('--- TIER x TIER_SOURCE TABLE ---')
sources = ('measured', 'rule', 'low_rom', 'unmeasured')
print('tier,total,' + ','.join(sources))
for tier in sorted(counts):
    print(','.join([tier, str(sum(counts[tier].values()))] + [str(counts[tier][source]) for source in sources]))
print('\n--- UP TO 20 RANDOM SAMPLES PER TIER (seed 42) ---')
rng = random.Random(42)
for tier in sorted(samples):
    print('\n' + tier + ':')
    for row in rng.sample(samples[tier], min(20, len(samples[tier]))):
        print('  ' + ', '.join(row))
