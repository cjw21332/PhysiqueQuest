# Edit Meal USDA suggestions and shared calorie progress — October 14, 2026

- Added FoodNameSearch to Edit Meal: typing searches the existing authenticated nutrition food-search endpoint after 400 ms. Up to five matching USDA candidates appear as selectable buttons. Loading, empty, and retry states are explicit; cleanup ignores obsolete responses and cancels pending debounce timers.
- Selecting a suggestion changes the food name and USDA identifier. Existing editable nutrition values remain for user review; no portion or nutrition recalculation is assumed from a name alone. Saved edits send the selected positive USDA identifier through the existing update DTO.
- Extracted Home Nutrition today's calorie ring into CalorieProgress and reused it in Today's Log. Both now share the existing Home SVG, compact number display, ring size, typography, and clamped progress behavior, including zero intake and exceeded targets.
- API keys remain server-side. No new endpoints, backend changes, packages, or persistence libraries were introduced.

Verification: all 82 frontend tests passed and the frontend production build passed. New tests exercise debounced API calls, stale-response isolation, suggestion selection, and empty/partial/exceeded calorie targets. Existing editor and navigation tests remain passing. USDA provider availability, live account persistence, and physical-device behavior were not verified. Checklist completion totals remain unchanged.
