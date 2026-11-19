import json
import os

test_dir = r'C:\Users\MY PC\Desktop\Projects\PhysiqueQuest\ml\reports\repcount'

# Load test metrics
with open(os.path.join(test_dir, 'test_metrics_summary.json')) as f:
    test_results = json.load(f)

# Load validation results
val_file = os.path.join(test_dir, 'validation_results.json')
with open(val_file) as f:
    val_data = json.load(f)

# Compute per-class validation metrics
from collections import defaultdict
val_class_stats = defaultdict(lambda: {'gt_list': [], 'pred_list': [], 'within1': 0, 'exact': 0})
for d in val_data:
    cls = d['class']
    gt = d['gt']
    pred = d['count']
    mae = abs(pred - gt)
    val_class_stats[cls]['gt_list'].append(gt)
    val_class_stats[cls]['pred_list'].append(pred)
    if mae <= 1:
        val_class_stats[cls]['within1'] += 1
    if mae == 0:
        val_class_stats[cls]['exact'] += 1

val_per_class = {}
for cls in sorted(val_class_stats.keys()):
    stats = val_class_stats[cls]
    n = len(stats['gt_list'])
    val_per_class[cls] = {
        'n': n,
        'mae': sum(abs(p - g) for p, g in zip(stats['pred_list'], stats['gt_list'])) / n,
        'exact_pct': sum(1 for p, g in zip(stats['pred_list'], stats['gt_list']) if p == g) / n * 100,
        'within1_pct': sum(1 for p, g in zip(stats['pred_list'], stats['gt_list']) if abs(p - g) <= 1) / n * 100,
    }

# Build per-class report combining validation and test
classes_of_interest = ['squat', 'push_up', 'bench_press', 'front_raise', 'pull_up', 'situp', 'jumping_jack']

report_per_class = {}
for cls in classes_of_interest:
    val_info = val_per_class.get(cls, None)
    test_info = test_results['per_class'].get(cls, None)
    
    # Determine reliability: within ±1 on >= 70% of videos
    test_reliable = test_info and test_info['within1_pct'] >= 70.0
    val_reliable = val_info and val_info['within1_pct'] >= 70.0
    
    report_per_class[cls] = {
        'validation': val_info,
        'test': test_info,
        'reliable_on_test': test_reliable,
        'reliable_on_val': val_reliable,
    }

# Final report
final_report = {
    'frozen_settings': json.load(open(os.path.join(test_dir, 'frozen_settings.json'))),
    'summary': {
        'validation_total_videos': len(val_data),
        'test_total_videos': test_results['total_test_videos_matched'],
        'test_excluded_videos': 16,
        'overall_validation_mae': 7.53,
        'overall_validation_exact_pct': 23.01,
        'overall_validation_within1_pct': 39.82,
        'overall_test_mae': test_results['overall_mae'],
        'overall_test_exact_pct': test_results['overall_exact_pct'],
        'overall_test_within1_pct': test_results['overall_within1_pct'],
    },
    'per_class': report_per_class,
    'reliability_assessment': {
        'reliable_classes': [],
        'unreliable_classes': [],
        'threshold': 'within ±1 on >= 70% of videos',
    },
    'notes': 'Test run once with frozen settings. No tuning on test set.',
}

# Classify reliability
for cls, info in report_per_class.items():
    test_info = info['test']
    if test_info and info['reliable_on_test']:
        final_report['reliability_assessment']['reliable_classes'].append(cls)
    else:
        final_report['reliability_assessment']['unreliable_classes'].append(cls)

with open(os.path.join(test_dir, 'FINAL_REPORT.json'), 'w') as f:
    json.dump(final_report, f, indent=2)

print('FINAL_REPORT.json generated successfully')
print(json.dumps(final_report, indent=2)[:2000])
