import json
with open('configs/pushupbench_taxonomy_mapping.json') as f:
    m = json.load(f)

ex1 = 'c-curl twist'
ex2 = 'reverse lunges challenge'
print(ex1, '->', m.get(ex1, 'NOT FOUND'))
print(ex2, '->', m.get(ex2, 'NOT FOUND'))
print(ex1.lower(), '->', m.get(ex1.lower(), 'NOT FOUND'))
print(ex2.lower(), '->', m.get(ex2.lower(), 'NOT FOUND'))

# Show all keys
print('\nAll keys:')
for k in sorted(m.keys()):
    print(' ', k)