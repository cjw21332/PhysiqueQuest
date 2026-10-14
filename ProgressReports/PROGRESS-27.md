# Today's Log meal descriptions and editing — October 14, 2026

Implemented the requested meal provenance, local logging time, edited marker, and saved-food editing flow.

- DailyLog uses Scanned for photo entries and Manual for manual entries, adds edited beside the source, and keeps the original time last. Empty categories display "No logged yet". Logged food rows have an accessible edit action and a subtle shared edit icon.
- The new EditMeal page reuses Scan headers, chips, inputs, and sticky save controls. It edits food name, meal category, calories, protein, carbohydrates, and fat. Multi-food categories offer individual food selection. Save validates values, waits for persistence, and exposes failures for retry; Cancel discards changes.
- ScanSection routes edits through the existing nutrition hook and update endpoint. Sample edit mode is captured when opened so background changes cannot accidentally turn a sample edit into an account write. Confirmed account responses refresh shared totals/history through existing hook behavior.
- New scan and manual entries capture the device-local logging time. Legacy records without a time are left truthful rather than inventing one.
- The nutrition service marks updates edited and preserves original source, date, and time; the Mongoose meal schema persists the default-false edited field. No new endpoints, services, dependencies, or state libraries were added.

Verification: the new backend regression first reproduced missing edited persistence and source/time replacement, then passed after correction. All 80 frontend tests and all 275 backend tests passed; frontend and backend production builds passed. Editor-handler tests cover pending saves, failure messages, and successful retry. Live database and physical mobile checks were not performed. Checklist totals are unchanged.
