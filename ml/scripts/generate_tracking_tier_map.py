import csv, json
from pathlib import Path

ML = Path(__file__).resolve().parents[1]
CSV = ML / 'reports' / 'coverage' / 'catalog_tiers.csv'
JSON = ML / 'models' / 'catalog_tiers.json'

tier_map = {}
with open(CSV, encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        # Map: beta_family -> auto_count_beta, candidate_unvalidated -> manual, others -> pose_only
        tier = row['tier']
        if tier == 'beta_family': mapping = 'auto_count_beta'
        elif tier == 'candidate_unvalidated': mapping = 'manual'
        else: mapping = 'pose_only'

        tier_map[row['exerciseId']] = {
            'tier': mapping,
            'pooled_n': row.get('pooled_n', ''),
            'pooled_within1_pct': row.get('pooled_within1_pct', '')
        }

with open(JSON, 'w', encoding='utf-8') as f:
    json.dump(tier_map, f, indent=1)
print(f"Generated {JSON}")
