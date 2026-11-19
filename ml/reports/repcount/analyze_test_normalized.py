import csv
import json
import os
from collections import Counter

test_manifest = r'C:\Users\MY PC\Desktop\Projects\PhysiqueQuest\ml\reports\repcount\test_manifest.csv'
test_dir = r'C:\Users\MY PC\Desktop\Projects\PhysiqueQuest\ml\reports\repcount'

# Load label map for normalization
with open(r'C:\Users\MY PC\Desktop\Projects\PhysiqueQuest\ml\configs\repcount_label_map.json') as f:
    label_map = json.load(f)

with open(test_manifest, newline='') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

print(f'Total rows: {len(rows)}')

# Count by normalized action_type
normalized_types = [label_map.get(row['action_type'], row['action_type']) for row in rows]
c = Counter(normalized_types)
print(f'\nNormalized action type counts:')
for k, v in sorted(c.items()):
    print(f'  {k}: {v}')

# Build lookup from test JSONs
test_results = {}
json_files = [f for f in os.listdir(test_dir) if f.startswith('test_') and f.endswith('.json')]
for jf in json_files:
    try:
        with open(os.path.join(test_dir, jf)) as fh:
            data = json.load(fh)
        key = jf.replace('test_', '').replace('.json', '')
        test_results[key] = data
    except Exception as e:
        print(f'Error reading {jf}: {e}')

print(f'Loaded {len(test_results)} test result files')

# Match test results with manifest
matched = 0
unmatched = 0
excluded = 0
class_stats = {}
gt_values = []
count_values = []
total = 0

for row in rows:
    vid = row['video_id']
    action_type = row['action_type']
    normalized = label_map.get(action_type, action_type)
    
    if normalized == 'excluded':
        excluded += 1
        continue
    
    if vid in test_results:
        data = test_results[vid]
        matched += 1
        
        gt = int(row['count'])
        predicted_count = data.get('count', 0)
        mae = abs(predicted_count - gt)
        
        if normalized not in class_stats:
            class_stats[normalized] = {'gt_list': [], 'pred_list': [], 'within1': 0, 'exact': 0}
        class_stats[normalized]['gt_list'].append(gt)
        class_stats[normalized]['pred_list'].append(predicted_count)
        if mae <= 1:
            class_stats[normalized]['within1'] += 1
        if mae == 0:
            class_stats[normalized]['exact'] += 1
            
        gt_values.append(gt)
        count_values.append(predicted_count)
        total += 1
    else:
        unmatched += 1
        print(f'  UNMATCHED: {vid} ({action_type} -> {normalized})')

print(f'\nMatched: {matched}, Unmatched: {unmatched}, Excluded: {excluded}')

# Overall metrics
if total > 0:
    mae = sum(abs(p - g) for p, g in zip(count_values, gt_values)) / total
    exact_count = sum(1 for p, g in zip(count_values, gt_values) if p == g)
    within1_count = sum(1 for p, g in zip(count_values, gt_values) if abs(p - g) <= 1)
    exact_pct = (exact_count / total) * 100
    within1_pct = (within1_count / total) * 100
    
    print(f'\nOverall metrics (all {total} matched videos):')
    print(f'  MAE: {mae:.2f}')
    print(f'  Exact: {exact_count}/{total} = {exact_pct:.2f}%')
    print(f'  Within ±1: {within1_count}/{total} = {within1_pct:.2f}%')
    
    print(f'\nPer-class metrics (normalized):')
    for cls in sorted(class_stats.keys()):
        stats = class_stats[cls]
        n = len(stats['gt_list'])
        if n > 0:
            c_gt = stats['gt_list']
            c_pred = stats['pred_list']
            c_mae = sum(abs(p - g) for p, g in zip(c_pred, c_gt)) / n
            c_exact = sum(1 for p, g in zip(c_pred, c_gt) if p == g)
            c_within1 = sum(1 for p, g in zip(c_pred, c_gt) if abs(p - g) <= 1)
            c_exact_pct = (c_exact / n) * 100
            c_within1_pct = (c_within1 / n) * 100
            
            print(f'  {cls}: n={n}, MAE={c_mae:.2f}, exact={c_exact_pct:.1f}%, within±1={c_within1_pct:.1f}%')

# Also compare with validation results
print('\n\n=== Comparison with validation results ===')
val_file = os.path.join(test_dir, 'validation_results.json')
if os.path.exists(val_file):
    with open(val_file) as fh:
        val_data = json.load(fh)
    
    val_classes = Counter(d['class'] for d in val_data)
    print(f'Validation classes: {dict(val_classes)}')
    print(f'Validation total: {len(val_data)}')
    
    val_gt = [d['gt'] for d in val_data]
    val_pred = [d['count'] for d in val_data]
    val_mae = sum(abs(p - g) for p, g in zip(val_pred, val_gt)) / len(val_gt)
    val_exact = sum(1 for p, g in zip(val_pred, val_gt) if p == g) / len(val_gt) * 100
    val_within1 = sum(1 for p, g in zip(val_pred, val_gt) if abs(p - g) <= 1) / len(val_gt) * 100
    print(f'Validation MAE: {val_mae:.2f}')
    print(f'Validation Exact %: {val_exact:.2f}%')
    print(f'Validation Within ±1%: {val_within1:.2f}%')

# Save results
results = {
    'total_test_videos_matched': total,
    'overall_mae': mae if total > 0 else 0,
    'overall_exact_pct': exact_pct if total > 0 else 0,
    'overall_within1_pct': within1_pct if total > 0 else 0,
    'per_class': {}
}
for cls, stats in sorted(class_stats.items()):
    n = len(stats['gt_list'])
    if n > 0:
        c_gt = stats['gt_list']
        c_pred = stats['pred_list']
        results['per_class'][cls] = {
            'n': n,
            'mae': sum(abs(p - g) for p, g in zip(c_pred, c_gt)) / n,
            'exact_pct': sum(1 for p, g in zip(c_pred, c_gt) if p == g) / n * 100,
            'within1_pct': sum(1 for p, g in zip(c_pred, c_gt) if abs(p - g) <= 1) / n * 100,
        }

with open(os.path.join(test_dir, 'test_metrics_summary.json'), 'w') as f:
    json.dump(results, f, indent=2)

print('\nSaved test metrics to test_metrics_summary.json')