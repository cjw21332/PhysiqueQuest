# Progress 68 — Remove barcode feature

Date: 2026-11-16

Removed the barcode option from meal-photo selection, the barcode lookup and manual product-label workflow, scanner-specific frontend and backend code, the native barcode bridge, and the unused decoding dependency. Existing stored meal metadata is retained for old records. The endpoint returns 404 and the connected phone's Scan menu was verified to show only photo capture and upload. Photo camera unit and browser checks passed; the backend build and 46 food-scan tests passed.

The phone also showed that the meal camera could close when Android displayed a permission prompt. The native camera now ignores that transient interruption and has a regression test. The revised Android app was rebuilt and installed, and the connected phone showed a live meal-camera preview with the shutter ready. No photo was captured or submitted.

The wider UI audit is not exhaustive. An additional suite initially passed 59 and failed 16, including changed meal and camera paths, account recovery, and workout controls. Meal and water paths and several barcode tests were subsequently addressed or removed with the feature; the remaining failures were not all resolved or retested.
