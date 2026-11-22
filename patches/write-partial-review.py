import json
from pathlib import Path

rows = json.loads(Path('patches/partial-event-diagnostics.json').read_text(encoding='utf-8'))
classes = {
 ('c01',16):'Incomplete initial descent; ambiguous',
 ('c06',63):'Hold noise / setup', ('c06',102):'Hold noise / setup', ('c06',124):'Hold noise / setup',
 ('c06',171):'Ambiguous: during visible curl; no separate completed short cycle established',
 ('c15',105):'Post-set movement', ('c15',233):'Post-set movement / empty apparatus',
 ('c15',234):'Post-set movement / empty apparatus', ('c15',243):'Post-set movement / empty apparatus',
 ('c17',58):'Jitter during full movement; no separate cycle established',
 ('c17',73):'Jitter during full movement; no separate cycle established',
 ('c17',84):'Jitter during full movement; no separate cycle established',
 ('c04',158):'Ambiguous: during visible dip; no separate short cycle established',
 ('c04',174):'Ambiguous: banner obscures working joints', ('c04',179):'Ambiguous: banner obscures working joints',
 ('c12',47):'Ambiguous: setup / camera movement and occlusion',
 ('c14',23):'Hold noise / setup', ('c14',81):'Ambiguous: during press, no distinct cycle established',
 ('c14',85):'Ambiguous: during press, no distinct cycle established',
}
lines=['# Baseline partial-event review', '',
 '**PROVISIONAL / UNREVIEWED.** Test examples are documented separately and were not used to select a candidate. No tracking change has been made.', '',
 'Excursion is the counter angle extrema as a percentage of the configured start-to-peak range, not a physical measurement. Cycle duration is counter departure to event; peak-to-return is from the most extreme sampled working-direction angle after departure to event. These estimates use 10 Hz samples and are not independent visual ground truth. When the extreme occurred before departure, peak-to-return is an upper bound or may be misleading. Screen recordings contain baked-in overlays. Classifications are tentative and ambiguous means the requested classes cannot be distinguished confidently.', '',
 '| Split | Clip | Time (s) | Excursion % | Cycle (ms) | Peak-return (ms) | Tentative class | Evidence image |', '|---|---|---:|---:|---:|---:|---|---|']
for x in rows:
    key=(x['clip'],x['frame']); img=Path(x['evidence_image']).name
    lines.append(f"| {x['split']} | {x['clip']} | {x['timestamp_s']:.3f} | {x['range_pct']:.1f} | {x['duration_ms']} | {x['peak_to_return_ms']} | {classes[key]} | [sheet](../output/pose-replay-private/partial-event-review/{img}) |")
lines += ['', '## Distribution limitations', '',
 'The only provisional visually labeled short cycle in the development set is c15 at 4.0–7.5 s. No emitted partial corresponds to that interval. On the replay trace, the right arm has usable angle samples in 26 of 36 frames; its max–min span is 45.3 degrees, approximately 39.4% of the configured 115-degree range. The left side has no usable angle samples. This whole-interval span is not necessarily the counter cycle excursion and the clip uses a questionable triceps-extension mapping for a dip. It is one provisional example, not a distribution.', '',
 'Development events classified as noise or post-set movement span 18.8–169.9% and 100–1,100 ms. This includes inaccurate model geometry. The one provisional real short cycle has a roughly 3,500 ms visual duration, but a single example cannot establish a timing distribution, nor an acceptable refractory period, especially for fast reps. Its approximate angle span overlaps the noise range. Ambiguous events were not included as confirmed positives or negatives. There is no defensible data-derived universal separation or cut-off.', '',
 'A proposed change must distinguish unobserved or implausible geometry and activity from valid shallow motion, retain partials, and test real short cycles; replacing one arbitrary range threshold with another would not satisfy the evidence requirement. The replay also omits the actual app start gate, so post-set counts in this proxy do not prove the app counted them.', '',
 '## Remaining work', '',
 'The single shared-counter patch, rejected timing events, activity gating, four generic-counter fixes and development replay have not been implemented. Held-out replay has not been rerun. No Priority 2 work has started.']
Path('patches/partial-event-review.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
print('Wrote patches/partial-event-review.md')
