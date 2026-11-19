import json
with open('reports/t1_quick/t1_quick_results.json') as f:
    data = json.load(f)
for k, v in data.items():
    print(f'Key: {k}')
    print(f'  error: {v.get("error", "NONE")}')
    print(f'  video_mode: {v.get("video_mode", {})}')
    print()