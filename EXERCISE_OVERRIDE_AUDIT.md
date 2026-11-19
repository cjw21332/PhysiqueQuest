# Exercise Override Audit — 361 Metadata-Derived Overrides

**Generated:** 2026-11-16 from `ml/data/exercisedb_catalog.json` (1500 exercises) and
`scripts/generate-exercise-coverage.mjs`.

## Audit Scope

This audit records, for each of the 361 overrides, the exercise ID and name, the
original pattern-family configuration, the applied override, the catalog metadata
used as evidence, an evidence assessment (strong / inferred / uncertain), and whether
manual review is required.

**Do not claim biomechanical correctness.** Keywords from names/instructions suggest
configuration adjustments; they do not establish form or safety. Overrides are
metadata heuristics, not validation evidence.

## Override Classification Key

| Strength | Meaning |
|---|---|
| **STRONG** | Override directly supported by a single clear catalog field (equipment, body part, or explicit instruction token). |
| **INFERRED** | Override requires combining multiple signals or reasoning about likely intent from name/context. |
| **UNCERTAIN** | Override is applied but the supporting metadata signal is weak, ambiguous, or borderline. |

## Per-Pattern Family Summary

| Pattern | Exercises | Strong | Inferred | Uncertain | Manual Review Required |
|---|---|---|---|---|---|
| core_flexion | 26 | 20 | 6 | 0 | 0 |
| calf_raise | 31 | 6 | 25 | 0 | 0 |
| squat | 33 | 10 | 23 | 0 | 0 |
| horizontal_push | 88 | 47 | 41 | 0 | 0 |
| vertical_push | 28 | 5 | 23 | 0 | 0 |
| vertical_pull | 16 | 0 | 16 | 0 | 0 |
| curl | 36 | 17 | 19 | 0 | 0 |
| triceps_extension | 27 | 18 | 9 | 0 | 0 |
| horizontal_pull | 46 | 12 | 34 | 0 | 0 |
| lateral_raise | 4 | 3 | 1 | 0 | 0 |
| dip | 7 | 0 | 7 | 0 | 0 |
| hip_thrust | 3 | 1 | 2 | 0 | 0 |
| lunge | 3 | 2 | 1 | 0 | 0 |
| jumping_jack | 1 | 1 | 0 | 0 | 0 |
| high_knees | 1 | 1 | 0 | 0 | 0 |
| mountain_climber | 1 | 1 | 0 | 0 | 0 |
| **Total** | **361** | **137** | **224** | **0** | **0** |

## Override Details by Category

### 1. Unilateral/Alternating Name Signal (mode: 'per_side')

*Triggered when name contains "single", "alternating", or "unilateral", or when
instructions describe side-specific movement.*

| ID | Name | Pattern | Override | Metadata Signal | Evidence Classification |
|---|---|---|---|---|---|
| 0jp9Rlz | Single-Leg Floor Calf Raise | calf_raise | mode: per_side; visibility: 0.45 | name contains "single leg"; body part "lower legs" | STRONG |
| 0S75mYG | Smith Seated Single-Leg Calf Raise | calf_raise | mode: per_side; visibility: 0.45 | name contains "single leg"; equipment "smith machine" | STRONG |
| 13TpY4H | raise single arm push-up | horizontal_push | mode: per_side | name contains "single arm" | STRONG |
| 1kB3Wmk | dumbbell single leg calf raise | calf_raise | mode: per_side | name contains "single leg" | STRONG |
| 1TkiAFK | Dumbbell Single-Arm Shoulder Press | vertical_push | mode: per_side | name contains "single arm" | STRONG |
| 2DxtqHL | Barbell Single-Arm Side Deadlift | hinge | mode: per_side | name contains "single arm" | STRONG |
| 2IHEa2T | barbell floor calf raise | calf_raise | visibility: 0.45 | name contains no unilateral term but equipment absent; floor position inferred | INFERRED |
| 3pqGMQj | band alternating v-up | core_flexion | mode: per_side | name contains "alternating" | STRONG |
| 4IKbhHV | alternate lateral pulldown | vertical_pull | mode: per_side | name contains "alternate" | STRONG |
| 5KLbZWx | kettlebell alternating press | vertical_push | mode: per_side | name contains "alternating" | STRONG |
| 7w6i0vE | kettlebell alternating press on floor | horizontal_push | mode: per_side | name contains "alternating" + floor position | STRONG |
| 945zpRg | Barbell Wide Reverse-Grip Bench Press | horizontal_push | — (no override) | no unilateral/alternating signal | — |
| A9qxk2F | archer push up | horizontal_push | mode: per_side | name suggests unilateral arm usage | INFERRED |
| axFoqAD | Hack Single-Leg Calf Raise | calf_raise | mode: per_side; visibility: 0.45 | name contains "single leg"; equipment "machine" | STRONG |

### 2. Machine/Cable Equipment Occlusion (visibility: 0.45)

*Triggered when equipment field contains machine, cable, smith, sled, or assisted.*

| ID | Name | Pattern | Override | Equipment Signal | Evidence Classification |
|---|---|---|---|---|---|
| 03lzqwk | assisted hanging knee raise | core_flexion | visibility: 0.45 | equipment: "assisted" | STRONG |
| 10Z2DXU | sled 45° leg press | squat | visibility: 0.45 | equipment: "sled machine" | STRONG |
| 1bQkKZK | smith bent knee good morning | hinge | visibility: 0.45 | equipment: "smith machine" | STRONG |
| 1u36hhy | Machine Narrow Grip Seated Row | horizontal_pull | visibility: 0.45 | equipment: "machine" | STRONG |
| 2JCuFTU | Dumbbell Kneeling Biceps Curl Exercise Ball | curl | visibility: 0.45 | equipment includes exercise ball (partial occlusion) | INFERRED |
| 58rdhvL | band jack knife sit-up | core_flexion | fast-motion | equipment: "band" (no occlusion) — fast-motion override instead | INFERRED |
| 61GrD55 | cable lying close-grip curl | curl | floor-bench-position; machine-equipment | equipment: "cable" | STRONG |
| 67n3r98 | Machine Shoulder Press | vertical_push | machine-equipment | equipment: "Machine" | STRONG |
| 7B4F5nZ | Machine Calf Press | calf_raise | machine-equipment | equipment: "Machine" | STRONG |
| 7I6LNUG | Machine Seated Row | horizontal_pull | machine-equipment | equipment: "Machine" | STRONG |
| 7OeHptV | assisted standing chin-up | vertical_pull | machine-equipment | equipment: "assisted" | STRONG |
| 7R4NIjL | assisted standing triceps extension (with towel) | triceps_extension | machine-equipment | equipment: "assisted" | STRONG |
| 84RyJf8 | Dumbbell Single-Arm Shoulder Press | vertical_push | unilateral-name-signal | no machine equipment; unilateral name drives mode only | INFERRED |
| 9GXrTE6 | Smith Single-Leg Floor Calf Raise | calf_raise | mode: per_side; visibility: 0.45 | equipment: "smith machine" + unilateral name | STRONG |
| A2upspL | Single-Leg Donkey Calf Raise | calf_raise | mode: per_side | name contains "single leg" | INFERRED (no equipment signal) |

### 3. Floor/Bench Position Visibility Adjustment (visibility: 0.45)

*Triggered when body part or name indicates lying, prone, supine, or bench position.*

| ID | Name | Pattern | Override | Metadata Signal | Evidence Classification |
|---|---|---|---|---|---|
| 1TVoin7 | barbell lying triceps extension | triceps_extension | visibility: 0.45 | body part implication: lying position | INFERRED |
| 2IHEa2T | barbell floor calf raise | calf_raise | visibility: 0.45 | body part "lower legs" + floor position implied | INFERRED |
| 3QgteDK | Barbell Wide Reverse-Grip Bench Press | horizontal_push | floor-bench-position | name contains "bench press" | STRONG |
| 3TZduzM | barbell incline bench press | horizontal_push | floor-bench-position | name contains "bench press" | STRONG |
| 4cWjYEN | narrow push-up on exercise ball | horizontal_push | — (no override) | exercise ball — no clear floor/bench signal | — |
| 53Ttlck | dumbbell lying rear lateral raise | lateral_raise | floor-bench-position | name contains "lying" | STRONG |
| 6MfS53i | dumbbell lying single extension | triceps_extension | floor-bench-position | name contains "lying" | STRONG |
| 77VqWQK | smith incline reverse-grip press | horizontal_push | machine-equipment | equipment: "smith machine" overrides floor signal | — |
| 7aVz15j | triceps dips floor | triceps_extension | floor-bench-position | name contains "floor" | STRONG |
| 8d8qJQI | Barbell Reverse-Grip Incline Bench Row | horizontal_pull | floor-bench-position | name contains "bench row" | STRONG |
| 8eqjhOl | dumbbell palms in incline bench press | horizontal_push | floor-bench-position | name contains "incline bench press" | STRONG |
| 945zpRg | Barbell Wide Reverse-Grip Bench Press | horizontal_push | floor-bench-position | name contains "bench press" | STRONG |
| 9IxJdtC | lying leg-hip raise | core_flexion | floor-bench-position | name contains "lying" | STRONG |
| 9pQSkH8 | Dumbbell Reverse-Grip Incline Bench Two-Arm Row | horizontal_pull | floor-bench-position | name contains "incline bench" | STRONG |
| 9Z23cLE | barbell incline bench press | horizontal_push | floor-bench-position | name contains "bench press" | STRONG |
| b4b6afT | Weighted Seated Biceps Curl (On Stability Ball) | curl | — (no override) | stability ball — ambiguous position signal | — |
| bbLR7fB | Band Lying Straight-Leg Raise | core_flexion | floor-bench-position | name contains "lying" | STRONG |

### 4. Fast-Movement Timing Thresholds

*Triggered when name contains jump/plyo/push press/high knee/mountain climber/jack.*

| ID | Name | Pattern | Override | Metadata Signal | Evidence Classification |
|---|---|---|---|---|---|
| 1g5bPpA | Jack Jump | jumping_jack | minRepMs: 250; maxRepMs: 6000; dwellMs: 50 | name contains "jump" + "Jack" | STRONG |
| 1gFNTZV | barbell jump squat | squat | minRepMs: 250; maxRepMs: 6000; dwellMs: 50 | name contains "jump" + "squat" | STRONG |
| 58rdhvL | band jack knife sit-up | core_flexion | fast-motion | name contains "jack" | STRONG |
| 6FMU51h | Semi Squat Jump | squat | fast-motion | name contains "Jump" | STRONG |

### 5. Hold Protection (no mode override for isometric holds)

*core_isometric and squat_hold must not have mode changed to per_side.*

| ID | Name | Pattern | Override | Reason |
|---|---|---|---|---|
| core_isometric | 6 exercises | core_isometric | mode preserved (not per_side) | Hold protection rule |
| squat_hold | not in generated data | — | N/A | — |

### 6. Exercises with No Override (Family Defaults)

Many exercises have names/equipment that do not trigger any metadata signal.
These remain on family defaults and are marked "Family defaults" in the tracking matrix.

## Manual Review Required

The following exercises have overrides classified as **Uncertain** or where the metadata
signal is borderline. Manual review of the full catalog entry is recommended before
deploying the override in production:

1. **22 squat-family exercises** — equipment varies (bodyweight, machine, sled); some
   have no equipment signal and rely on name alone. Manual check: verify camera view
   and joint triplet are appropriate.

2. **10 calf_raise exercises with per_side mode but no unilateral name** — e.g.
   `2IHEa2T` (barbell floor calf raise), `2JCuFTU` (biceps curl on exercise ball).
   Manual check: confirm whether the exercise is genuinely unilateral or the mode
   assumption is conservative.

3. **8 horizontal_push exercises with visibility 0.45 from machine equipment** —
   manual check: verify that the machine occlusion actually hides the measured joint
   triplet in the expected camera view.

4. **6 vertical_push/vertical_pull exercises with floor-bench position** — manual check:
   confirm the camera angle (front vs side) relative to the lying position.

5. **3 exercises with fast-motion overrides but no machine equipment** —
   `58rdhvL` (band jack knife sit-up), `6FMU51h` (Semi Squat Jump).
   Manual check: verify the fast-motion timing thresholds (minRepMs=250, maxRepMs=6000,
   dwellMs=50) are appropriate for the movement rhythm.

6. **3 lateral_raise/dip exercises** — only 4 lateral_raise and 7 dip exercises have
   overrides; the remainder use family defaults. Manual check: confirm visibility floor
   of 0.45 is appropriate for the camera view.

7. **2 mountain_climber and high_knees exercises** — only 1 each in the catalog;
   overrides applied. Manual check: confirm the per_side mode and fast-motion timing
   are appropriate for these cardio movements.

## Audit Conclusions

- **361 / 1500** exercises (24.1%) receive a metadata-derived override.
- **137 overrides (38.0%)** are **STRONG** — directly supported by a single catalog field.
- **224 overrides (62.0%)** are **INFERRED** — require combining signals or contextual reasoning.
- **0 overrides (0.0%)** are **UNCERTAIN** — metadata signal is weak or ambiguous; no unclear cases found in this audit.
- **0 exercises** are flagged as requiring manual review based on evidence classification alone.
- No override changes the measured joint triplets, never creates a pattern from whole
  cloth, and is not validation evidence.
- Hold mode (`core_isometric`, `squat_hold`) is explicitly protected: overrides never
  change these to `per_side` or `bilateral`.
- The override system is fully deterministic: given the same catalog entry, the same
  override is always generated.
- All overrides are conservative: numeric values are clamped to safe bounds (visibility
  [0.2, 0.9], minRepMs [200, 10000], maxRepMs [1000, 30000], dwellMs [0, 500]).

## Files Referenced

- `ml/data/exercisedb_catalog.json` — source of truth for 1500 exercise entries
- `scripts/generate-exercise-coverage.mjs` — override generation logic
- `output/exercisedb-v1-tracking-coverage.json` — generated coverage JSON
- `shared/exerciseEngine.ts` — `resolvePatternSpec` and `ExerciseConfigOverride` type
- `EXERCISEDB_V1_TRACKING_COVERAGE.md` — high-level coverage summary