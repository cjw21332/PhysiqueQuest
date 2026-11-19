# Food scanner mobile test checklist

Not yet performed on a physical device. Use an isolated test account and non-sensitive, consented meal photographs; configure the backend provider keys and a test database first. Do not put credentials on the device.

The web review workflow has automated browser coverage including upload, correction and exclusion. A separate browser test uses the real backend and isolated MongoDB with synthetic input and mocked providers. Neither is a real camera, native-device or live-provider test. Record device and OS for each checklist result.

The protected save flow requires persistent local storage and Web Locks. Verify both in the native WebView before deployment; unsupported environments now show an error instead of silently risking duplicate saves. Test a lost response followed by app restart and recovery; clearing browser storage cannot recover the retained payload.

1. On a phone, deny camera permission, confirm a clear recovery path, then allow it and capture a meal. Repeat with front/back camera where available. Confirm preview, retake and cancellation.
2. Select portrait and landscape photos from the device, including a photo with EXIF rotation, a large photo, unsupported/corrupt files and a poor network. Confirm orientation, resized JPEG upload, size enforcement, loading, retry and error behavior.
3. Review multiple foods. Replace an incorrect identification with a USDA search result, add a missing food, enter grams, exclude and restore a food, and check item and meal totals. Test a long food name and a long list at narrow and large phone widths; check scrolling, focus, accessible labels and the sticky save action.
4. Confirm the meal, reload the diary, and compare persisted values, weights, USDA record ID and source against server-side calculations. Verify another test account cannot access the record. Repeat after a network interruption and a second save attempt to assess duplicates.
5. Repeat in the native wrapper on actual iOS and Android devices, including background/foreground transitions and permission changes. Record device, OS, app/backend version, photos used, results and defects. Do not treat a browser emulator as a native or physical-device test.
# Recovery compatibility caveat (2026-11-15)

The protected save path currently requires Web Locks; it fails closed when the
API is absent, including in unsupported native WebViews. A process-local lock
would not coordinate browser tabs or independent application processes. An
atomic shared local reservation and server idempotency need design and tests
before replacing this behavior. Local storage clearing and device changes can
still lose an unresolved recovery record. Physical Android and iOS tests have
not been performed.

