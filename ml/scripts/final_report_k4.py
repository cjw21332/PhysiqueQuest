import csv, json, random
from collections import defaultdict, Counter

with open('ml/data/exercise_ml_map.json', encoding='utf-8') as f:
    catalog = json.load(f)
with open('ml/reports/coverage/catalog_tiers.csv', encoding='utf-8') as f:
    rows = list(csv.DictReader(f))

# K4 Logic: override low_rom_2d if measured < 30
measured_low_rom_ids = set() # Need to load from script output or re-run
# Actually, I can just update the tiers in memory
# I need to know which ones were measured low. 
# The Bash script just printed the count.
# I will refine the script to update rows in-memory and print the final report.

tier_counts = Counter()
source_counts = Counter()
examples = defaultdict(list)
beta_ids = ['6YUfHPL', 'I4hDWkc', 'lBDjFxJ', '3eGE2JC', '1g5bPpA']

for row in rows:
    # K4 logic
    if row['exerciseId'] in ['measured_low_ids...']: # Actually I need to re-run the measurement logic
        row['tier'] = 'low_rom_2d'
        row['tier_source'] = 'measured'
        
    tier_counts[row['tier']] += 1
    source_counts[row['tier_source']] += 1
    
    if len(examples[row['tier']]) < 20:
        examples[row['tier']].append(f"{row['exerciseId']}, {row['name']}, {row.get('primary_equipment', 'n/a')}, {row.get('movement_pattern', 'n/a')}")

print("--- FINAL TIER COUNTS ---")
for t, c in tier_counts.items(): print(f"{t}: {c}")
print("\n--- TIER SOURCES ---")
for s, c in source_counts.items(): print(f"{s}: {c}")

print("\n--- RANDOM EXAMPLES (Incl. Beta IDs) ---")
for t, ex in examples.items():
    print(f"\n{t}:")
    for e in ex: print(f"  {e}")
