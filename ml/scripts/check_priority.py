import json

with open('data/exercisedb_catalog.json') as f:
    catalog = json.load(f)

with open('data/exercise_ml_map.json') as f:
    ml_map = json.load(f)

priority = [
    'bodyweight squat', 'goblet squat', 'barbell squat', 'push-up', 'incline push-up',
    'dumbbell bench press', 'barbell bench press', 'dumbbell shoulder press',
    'lat pulldown', 'seated cable row', 'bent-over dumbbell row', 'pull-up',
    'bicep curl', 'hammer curl', 'triceps pushdown', 'lateral raise',
    'forward lunge', 'romanian deadlift', 'plank', 'glute bridge', 'hip thrust',
    'crunch', 'calf raise'
]

print('=== PRIORITY EXERCISE LOOKUP ===')
for p in priority:
    matches = [ex for ex in catalog if p.lower() in ex['name'].lower()]
    if matches:
        for m in matches[:3]:
            mid = m['exerciseId']
            ml = ml_map.get(mid, {})
            pattern = ml.get('movement_pattern', 'N/A')
            trackable = ml.get('trackable', 'N/A')
            needs_review = ml.get('needs_review', 'N/A')
            print(f'  FOUND: {m["name"]} (ID: {mid}) -> Pattern: {pattern}, Trackable: {trackable}, NeedsReview: {needs_review}')
    else:
        print(f'  MISSING: {p}')