import csv
from collections import defaultdict, Counter

# Read headers first to verify
with open('ml/reports/coverage/catalog_tiers.csv', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames
    print(f"DEBUG: CSV Fields: {fieldnames}")

tiers = defaultdict(lambda: {'measured': 0, 'rule': 0})
examples = defaultdict(list)

with open('ml/reports/coverage/catalog_tiers.csv', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        # Check if row has the expected key
        equip = row.get('primary_equipment', 'unknown')
        tier = row.get('tier', 'unknown')
        
        source = 'measured' if tier == 'beta_family' else 'rule'
        tiers[tier][source] += 1
        
        if len(examples[tier]) < 20:
            examples[tier].append(f"{row['name']} ({equip}, {row['movement_pattern']}, {source})")
            
print("--- TIER COUNTS AND SOURCES ---")
for tier, counts in tiers.items():
    total = counts['measured'] + counts['rule']
    print(f"{tier}: {total} (measured: {counts['measured']}, rule: {counts['rule']})")

print("\n--- 20 RANDOM EXAMPLES PER TIER ---")
for tier, ex in examples.items():
    print(f"\n{tier}:")
    for e in ex: print(f"  {e}")
