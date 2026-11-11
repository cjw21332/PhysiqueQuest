import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
labels={'squant':'squat','squat':'squat','push_up':'push_up','pushups':'push_up','pull_up':'pull_up','pullups':'pull_up','bench_pressing':'bench_press','benchpressing':'bench_press','front_raise':'front_raise','frontraise':'front_raise','jump_jack':'jumping_jack','jumpjacks':'jumping_jack','situp':'situp','battle_rope':'excluded','pommelhorse':'excluded','others':'excluded'}
ids={'squat':'6YUfHPL','push_up':'I4hDWkc','pull_up':'lBDjFxJ','bench_press':'EIeI8Vf','front_raise':'3eGE2JC','situp':'Bn6TXyO','jumping_jack':'1g5bPpA'}
configs={c['exercise_id']:c for c in json.loads((root/'models/generated_angle_configs.json').read_text())}
mapping={label:{'exerciseId':eid,'name':configs[eid]['name'],'parameter_source':configs[eid]['parameter_source'],'config_snapshot':configs[eid]} for label,eid in ids.items()}
(root/'configs/repcount_label_map.json').write_text(json.dumps(labels,indent=2))
(root/'configs/repcount_class_map.json').write_text(json.dumps(mapping,indent=2))
print(json.dumps({k:{a:b for a,b in v.items() if a!='config_snapshot'} for k,v in mapping.items()},indent=2))
