import json
from pathlib import Path

ML = Path('ml')
json_path = ML / 'models' / 'catalog_tiers.json'
ts_path = Path('backend/src/pose-tracker/catalog-tiers.ts')

with open(json_path, encoding='utf-8') as f:
    data = json.load(f)

ts_content = f"""// Auto-generated catalog tiers map from catalog_tiers.json
export type CatalogTierEntry = {{
  tier: 'auto_count_beta' | 'manual' | 'pose_only';
  classification: 'beta_family' | 'candidate_unvalidated' | 'pose_unreliable' | 'no_reps' | 'hold_timer' | 'low_rom_2d';
  tier_source: 'measured' | 'rule' | 'low_rom' | 'unmeasured';
  reason: string;
  pooled_n?: string;
  pooled_within1_pct?: string;
}};

export const catalogTiersMap: Record<string, CatalogTierEntry> = {json.dumps(data, indent=2)};
"""

ts_path.parent.mkdir(parents=True, exist_ok=True)
with open(ts_path, 'w', encoding='utf-8') as f:
    f.write(ts_content)

print(f"Generated {ts_path} with {len(data)} entries.")
