# Food scanner accuracy report

**Status: incomplete.** Real photographs evaluated: **0**. Measured food items: **0**. Identification, omission, extra-item, weight and nutrition accuracy are unavailable. No accuracy percentages or targets are represented as measured results.

The initial collection target is at least 30 consented meals across the categories below; this is a starting point and does not establish statistical reliability. No food photographs or measured ground-truth weights were supplied in this phase.

A live Gemini scan of a synthetic one-pixel image succeeded; it supplies no evidence of meal-recognition or portion accuracy. No actual food image was sent in this phase.

## Dataset and method

Keep consented images and annotations outside the public repository. Store one JSON manifest with `dataset_kind: "real"` and a `meals` array. Each meal has a unique `id`, an `image` path, one or more `categories`, and `ground_truth`, `predicted` and `pairs` arrays. Record photographer/meal split, plate diameter where measured, angle, lighting, capture date, preparation, cooking state, USDA reference ID and source in the annotation file alongside each food. Measure edible mass on a kitchen scale. Each ground-truth and prediction entry requires a unique `id`, `name`, positive `weight_g`, and a `nutrition` object with `kcal`, `carbs_g`, `protein_g`, `fat_g`; use null for unavailable values. Keep the original scanner output and model/configuration alongside the manifest. The evaluator does not inspect images, confirm provenance or validate an annotation's truth: the reviewer must do so.

Include single-food, two-food, three-plus-food, overlap, multiple pieces, mixed dishes, Filipino foods, varied plate size, camera angle, poor lighting, blur, and partial occlusion categories. Collect rice/chicken, rice/pork, rice/egg, adobo, sinigang, pancit, fried rice, vegetables and sauces where available. Separate different photos of the same meal across neither development nor held-out evaluation. Include failures and image exclusions in the dataset log.

An independent reviewer must create one-to-one `pairs` with `truth_id`, `prediction_id`, `identity_correct`, and `preparation_correct` (true, false, or null if not assessable). Only a confirmed identity **and** preparation count as a correct identification; wrong or unassessed preparation receives no full-match credit. A matched but wrong or unassessed item is reported as incorrect; unpaired truth and predictions are reported as missing and extra. Assess duplicate dish/ingredient predictions as extra or incorrect, with an annotation explaining the adjudication. Correct-pair weight error is absolute grams and absolute percentage. Report mean and median. Nutrition error is absolute difference, both per correct matched item and per entire meal; missing nutrients are omitted from that nutrient's denominator, never converted to zero. Category breakdowns overlap when a meal has multiple tags. Preparation accuracy uses only assessed pairs with a correct identity. Precision and recall are correct predictions divided by all predictions and all ground-truth items respectively.

Run `node scripts/evaluate-food-scanner.mjs path/to/manifest.json path/to/report.json` from `backend/`. Without an output path, JSON is printed. Run `node --test test/food-scanner-evaluation.test.mjs` for explicitly synthetic arithmetic/validation tests. The empty manifest is valid and yields null accuracy values. Never publish the synthetic test as a real benchmark. Record sample size and uncertainty intervals in the eventual report. Establish acceptance thresholds with clinical/nutrition and product stakeholders before inspecting held-out results; proposed engineering gates should include separate detection, preparation, per-item weight, meal nutrition, failure-rate and subgroup criteria, not an unvalidated universal accuracy percentage.

## Portion and segmentation decision

Current grams are an uncalibrated Gemini estimate from a 2D image; there is no measured plate reference, depth, volume, density model or pixel segmentation. Region and portion confidence and lower/upper bounds are unavailable. Defer deployment of segmentation until a representative, measured and region-annotated dataset exists; prototype a food-trained instance model against it, measuring region quality, overlap and mixed-dish failures, latency, model size, infrastructure and operating cost against the existing workflow. A generic YOLO segmentation model is not evidence of adequate food-instance coverage. Compare user-assisted scale entry and known plate dimensions separately. Manual correction remains essential.
# Follow-up status (2026-11-15)

No measured real-food photographs were evaluated in this follow-up. The
synthetic-image provider smoke test does not measure food recognition or
portion accuracy. Collect and evaluate at least 30 independently measured meals
using the existing evaluation instructions before drawing accuracy conclusions.

