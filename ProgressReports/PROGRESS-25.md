# Progress Report 25 — Scan Reference UI

Date: October 14, 2026

## Scope

Replicated the supplied reference presentation for Nutrition/Scan, Review Estimate, Today’s Log, Add Food, and Food History. Read and applied GENERAL.md, DESIGN.md, DATABASE.md, PROCEDURES.md, and the frontend-design skill. Changes are frontend presentation and local sample-preview behavior; backend source, the existing API client, and the nutrition hook were not changed.

## User-visible changes

- Nutrition shows the reference calorie ring, macro bars, green camera CTA, compact meal rows, and More links into Today’s Log and Food History.
- Review Estimate shows the photo and detected items, confidence badges, low-confidence guidance, meal/portion choices, estimated macros, and the two-action sticky footer. Item exclusion and portion scaling update the matched-item payload without changing backend field names. Existing analysis loading, timeout hints, errors/retry, unmatched-item exclusion, and degraded-result notices remain.
- Today’s Log uses the same daily totals, meal details, and shared water state. Glass icons and the eight-glass presentation match the reference; the narrowest phones wrap controls into four columns.
- Add Food uses meal pills, search, recent suggestions, selected food rows, portion/unit inputs, calculated nutrition, and a sticky Save to [meal] action. Live candidates/detail/save stay API-backed. Unit changes preserve the actual grams; saves wait for confirmation and show failures.
- Food History shows 7/30/90-day choices, the saved-day average, target comparison and chart line, energy-based macro percentages, and expandable daily records. History and Today’s Log retain the main tabs; Add Food and Review Estimate hide them. New internal views begin at the top of the content region.

## Sample data and preserved connections

The labeled preview is eligible only after a successful nutrition response with no meals and no water. It displays the requested 1,420 kcal, 96/180/42 g macros, five water glasses, three chicken candidates, 150 g portion, 620 kcal estimate, and 1,947 kcal history average with 28/47/25% macro split. History dates follow the local current week, rather than pretending September reference dates are current saved records.

Sample manual saves, scan saves, and water changes remain in section memory and refresh the connected preview screens. They never write account data or recent-food storage. Preview mode stays stable during background refreshes but yields immediately to real records, recorded water, or API errors. Negative sample food IDs are additionally guarded against persistence calls.

Actual camera/upload selections still call the existing backend analysis endpoint. Sample estimates are available only through the separate View sample estimate action; provider errors remain errors. Existing live search, detail, meal creation, water updates, and scan-to-meal saving keep the same API boundary and request contracts. No new microservice or backend integration was introduced.

## Important files

- `frontend/sections/Scan/ScanSection.tsx`: existing controller plus isolated shared preview state and navigation.
- `frontend/sections/Scan/NutritionDashboard.tsx`, `ReviewEstimate.tsx`, `DailyLog.tsx`, `AddFood.tsx`, `FoodHistory.tsx`: reference layouts and interactions.
- `frontend/sections/Scan/nutritionPresentation.ts`: display summaries, scan portion scaling, and sample fixtures.
- `frontend/sections/Scan/types.ts`: optional presentation metadata for the edited reference meal.
- `frontend/sections/Home/icons.tsx`: shared glass, chart, and retake SVGs.
- `frontend/app/globals.css`: all new styles scoped to Scan/reference components.
- `frontend/public/scan-meal-reference.png`: unchanged supplied reference, displayed through its food-photo region for the sample estimate.
- `frontend/tests/nutrition-presentation.test.mjs`: preview eligibility, cross-screen fixture consistency, immutable portion scaling, and rendered matched/error review coverage.
- Rule docs and `docs/checklist.md`: current behavior and verification limitations recorded.

## Verification

- Full frontend suite: 74/74 passed after final code changes.
- Production build: passed, including TypeScript and the original 14 static pages. A stale generated development validator referenced the removed temporary preview route; deleting that generated file resolved the first final-build attempt. No production route was added.
- Local browser checks mounted the actual ScanSection against a temporary local mock API, with synthetic responses only. Confirmed linked navigation, manual search/detail selection, grams/servings conversion, calculated values, history periods/record expansion, sample manual/scan saves, and sample water changes.
- The test service observed live-path requests to `/nutrition/foods/search`, `/nutrition/foods/:id`, `/nutrition/meals`, `/nutrition/water`, `/nutrition/scan`, and `/nutrition/meals/from-scan`. An uploaded test image opened Review Estimate immediately; excluding one detected item saved only the other two. Returned values updated Today’s Log. These are simulated API receipts, not production persistence evidence.
- Sample-only sessions produced nutrition GET requests and no persistence writes. Nutrition failure displayed its error/retry without samples. Scan-provider failure displayed retry, no detected items, and a disabled Save entry button.
- Responsive review covered 320×568, 390×844, 768×1024, 1440×900, and short landscape 844×390. Checked list/form layouts, footer bounds, scrolling, and absence of horizontal document overflow.
- Temporary preview route and development-generated instruction files removed; temporary services stopped; browser viewport reset. No publishing, commits, or pushes performed.
- Final whitespace/diff check passed.

## Not verified

No deployed scanner/microservice, real Gemini/USDA response, genuine account/database transaction, or physical Expo camera/device was tested. The backend’s existing implementation and connection configuration remain unchanged. Checklist live/provider/end-to-end marks and totals remain unchanged.
