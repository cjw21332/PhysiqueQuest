# Baseline partial-event review

**PROVISIONAL / UNREVIEWED.** Test examples are documented separately and were not used to select a candidate. No tracking change has been made.

Excursion is the counter angle extrema as a percentage of the configured start-to-peak range, not a physical measurement. Cycle duration is counter departure to event; peak-to-return is from the most extreme sampled working-direction angle after departure to event. These estimates use 10 Hz samples and are not independent visual ground truth. When the extreme occurred before departure, peak-to-return is an upper bound or may be misleading. Screen recordings contain baked-in overlays. Classifications are tentative and ambiguous means the requested classes cannot be distinguished confidently.

| Split | Clip | Time (s) | Excursion % | Cycle (ms) | Peak-return (ms) | Tentative class | Evidence image |
|---|---|---:|---:|---:|---:|---|---|
| DEVELOPMENT | c01 | 1.601 | 50.8 | 1500 | 900 | Incomplete initial descent; ambiguous | [sheet](../output/pose-replay-private/partial-event-review/c01-0016.jpg) |
| DEVELOPMENT | c06 | 6.301 | 18.8 | 400 | 400 | Hold noise / setup | [sheet](../output/pose-replay-private/partial-event-review/c06-0063.jpg) |
| DEVELOPMENT | c06 | 10.201 | 31.0 | 500 | 100 | Hold noise / setup | [sheet](../output/pose-replay-private/partial-event-review/c06-0102.jpg) |
| DEVELOPMENT | c06 | 12.401 | 19.2 | 1100 | 1000 | Hold noise / setup | [sheet](../output/pose-replay-private/partial-event-review/c06-0124.jpg) |
| DEVELOPMENT | c06 | 17.101 | 79.7 | 1400 | 900 | Ambiguous: during visible curl; no separate completed short cycle established | [sheet](../output/pose-replay-private/partial-event-review/c06-0171.jpg) |
| DEVELOPMENT | c15 | 10.501 | 150.5 | 100 | 100 | Post-set movement | [sheet](../output/pose-replay-private/partial-event-review/c15-0105.jpg) |
| DEVELOPMENT | c15 | 23.301 | 100.6 | 500 | 400 | Post-set movement / empty apparatus | [sheet](../output/pose-replay-private/partial-event-review/c15-0233.jpg) |
| DEVELOPMENT | c15 | 23.401 | 96.1 | 900 | 600 | Post-set movement / empty apparatus | [sheet](../output/pose-replay-private/partial-event-review/c15-0234.jpg) |
| DEVELOPMENT | c15 | 24.301 | 88.4 | 400 | 300 | Post-set movement / empty apparatus | [sheet](../output/pose-replay-private/partial-event-review/c15-0243.jpg) |
| DEVELOPMENT | c17 | 5.801 | 99.6 | 100 | 100 | Jitter during full movement; no separate cycle established | [sheet](../output/pose-replay-private/partial-event-review/c17-0058.jpg) |
| DEVELOPMENT | c17 | 7.301 | 169.9 | 100 | 100 | Jitter during full movement; no separate cycle established | [sheet](../output/pose-replay-private/partial-event-review/c17-0073.jpg) |
| DEVELOPMENT | c17 | 8.401 | 82.1 | 100 | 100 | Jitter during full movement; no separate cycle established | [sheet](../output/pose-replay-private/partial-event-review/c17-0084.jpg) |
| TEST | c04 | 15.801 | 83.3 | 1400 | 600 | Ambiguous: during visible dip; no separate short cycle established | [sheet](../output/pose-replay-private/partial-event-review/c04-0158.jpg) |
| TEST | c04 | 17.401 | 28.6 | 500 | 500 | Ambiguous: banner obscures working joints | [sheet](../output/pose-replay-private/partial-event-review/c04-0174.jpg) |
| TEST | c04 | 17.901 | 133.4 | 400 | 400 | Ambiguous: banner obscures working joints | [sheet](../output/pose-replay-private/partial-event-review/c04-0179.jpg) |
| TEST | c12 | 4.701 | 65.1 | 600 | 100 | Ambiguous: setup / camera movement and occlusion | [sheet](../output/pose-replay-private/partial-event-review/c12-0047.jpg) |
| TEST | c14 | 2.301 | 78.4 | 1000 | 1000 | Hold noise / setup | [sheet](../output/pose-replay-private/partial-event-review/c14-0023.jpg) |
| TEST | c14 | 8.101 | 45.0 | 600 | 100 | Ambiguous: during press, no distinct cycle established | [sheet](../output/pose-replay-private/partial-event-review/c14-0081.jpg) |
| TEST | c14 | 8.501 | 191.6 | 300 | 200 | Ambiguous: during press, no distinct cycle established | [sheet](../output/pose-replay-private/partial-event-review/c14-0085.jpg) |

## Distribution limitations

The only provisional visually labeled short cycle in the development set is c15 at 4.0–7.5 s. No emitted partial corresponds to that interval. On the replay trace, the right arm has usable angle samples in 26 of 36 frames; its max–min span is 45.3 degrees, approximately 39.4% of the configured 115-degree range. The left side has no usable angle samples. This whole-interval span is not necessarily the counter cycle excursion and the clip uses a questionable triceps-extension mapping for a dip. It is one provisional example, not a distribution.

Development events classified as noise or post-set movement span 18.8–169.9% and 100–1,100 ms. This includes inaccurate model geometry. The one provisional real short cycle has a roughly 3,500 ms visual duration, but a single example cannot establish a timing distribution, nor an acceptable refractory period, especially for fast reps. Its approximate angle span overlaps the noise range. Ambiguous events were not included as confirmed positives or negatives. There is no defensible data-derived universal separation or cut-off.

A proposed change must distinguish unobserved or implausible geometry and activity from valid shallow motion, retain partials, and test real short cycles; replacing one arbitrary range threshold with another would not satisfy the evidence requirement. The replay also omits the actual app start gate, so post-set counts in this proxy do not prove the app counted them.

## Remaining work

The single shared-counter patch, rejected timing events, activity gating, four generic-counter fixes and development replay have not been implemented. Held-out replay has not been rerun. No Priority 2 work has started.
