# Evaluation data layout

This directory contains only an empty manifest; it contains no real photographs or measurements. Keep consented evaluation data in private storage, for example:

```text
private-food-evaluation/
  images/                 original consented meal photographs
  annotations/            measured identities, preparation and USDA references
  predictions/            original scanner responses and model/config versions
  manifest.json           reviewer-adjudicated pairs for the evaluator
  reports/                generated JSON and a separately reviewed written report
```

Copy `manifest.empty.json` into private storage. For each meal add an image path, category tags, independently measured ground-truth items, scanner predictions and one-to-one reviewer-adjudicated pairs as specified in [the accuracy report](../food-scanner-accuracy-report.md). Record scale measurements, food preparation and cooking state, ground-truth nutrient source/record and photographer/meal split in the annotation records. Keep all photos of the same meal in one split. Use null for unavailable nutrients; do not substitute zero. Protect and delete image data according to participant consent and applicable retention policy.

Start with at least 30 consented meals as a practical collection target, not a statistically validated sample size. Photograph before eating, weigh each edible component separately with a kitchen scale, and record recipes, sauces, preparation and source references. Have a second reviewer adjudicate names and pairings without seeing weights predicted by the scanner. Record failed scans as well as successful ones. Only run live image analysis with permission for the image to be sent to the provider.

Shape example only: the following values and image path are **synthetic**, not measurements or benchmark results.

```json
{
  "dataset_kind": "synthetic",
  "meals": [{
    "id": "example-1", "image": "images/example.jpg", "categories": ["single-food"],
    "ground_truth": [{ "id": "g1", "name": "example rice", "weight_g": 100,
      "preparation_method": "boiled", "cooking_state": "cooked", "reference": "example-only",
      "nutrition": { "kcal": 120, "carbs_g": 25, "protein_g": 2, "fat_g": null } }],
    "predicted": [{ "id": "p1", "name": "example rice", "weight_g": 110,
      "nutrition": { "kcal": 132, "carbs_g": 27, "protein_g": 2.2, "fat_g": null } }],
    "pairs": [{ "truth_id": "g1", "prediction_id": "p1", "identity_correct": true, "preparation_correct": true }]
  }]
}
```
