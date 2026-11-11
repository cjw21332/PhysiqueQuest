import json
from pathlib import Path

ML = Path('ml')
REPORT = ML / 'reports' / 'repcount' / 'FINAL_REPORT.json'
CATALOG = ML / 'data' / 'exercise_ml_map.json'
TS_OUTPUT = Path('backend/src/pose-tracker/catalog-tiers.ts')

report = json.load(open(REPORT, encoding='utf-8'))
catalog = json.load(open(CATALOG, encoding='utf-8'))

# Beta family mapping
beta_mapping = {
    '6YUfHPL': {'name': 'squat', 'class': 'squat'},
    'I4hDWkc': {'name': 'push_up', 'class': 'push_up'},
    'lBDjFxJ': {'name': 'pull_up', 'class': 'pull_up'},
    '3eGE2JC': {'name': 'front_raise', 'class': 'front_raise'},
    '1g5bPpA': {'name': 'jumping_jack', 'class': 'jumping_jack'},
}

tiers = {}
for ex_id, ex in catalog.items():
    if ex_id in beta_mapping:
        cls = beta_mapping[ex_id]['class']
        stats = report['per_class'][cls]['pooled']
        tiers[ex_id] = {
            'tier': 'auto_count_beta',
            'pooled_n': str(stats['n']),
            'pooled_within1_pct': str(stats['within1_pct'])
        }
    else:
        tiers[ex_id] = {'tier': 'manual'}

# Generate TS
ts_content = "export const catalogTiersMap = " + json.dumps(tiers, indent=2) + ";"
TS_OUTPUT.write_text(ts_content)
print(f"Generated {TS_OUTPUT}")
