# Push delivery

`PUSH_PROVIDER=dry-run` is the default. It persists `dry-run-not-sent`, never a remote delivery success. Set `PUSH_PROVIDER=expo` to enable outbound Expo HTTPS requests. `EXPO_ACCESS_TOKEN` is optional when enhanced push security is disabled; enable Expo enhanced security and provide the server secret at deployment. Tokens must never be logged or exposed in responses.

Register from an authenticated app using `PUT /api/push/devices` with `{deviceId,token}`. Generate a stable installation identifier (16–128 alphanumeric/underscore/dash characters); obtain the token using Expo's `getExpoPushTokenAsync` with the EAS project ID. Repeat registration when Expo rotates the token. `DELETE /api/push/devices/:deviceId` revokes only the caller's registration; call it before logout/account switching. A token cannot transfer silently between accounts. A device token version prevents an old receipt from deleting a newly rotated token.

Server code calls `PushService.enqueue(userId,notificationId)` after persisting an owned in-app notification. Queue records contain references, scheduling/status metadata and Expo receipt IDs; they contain no notification body, media, health fields, token or email. Remote payloads are deliberately generic: “You have a new notification.” Fetch actual content through the authenticated API. Duplicates for the same notification/device are prevented by a unique index. Mongo leases resume interrupted processing; provider timeouts can cause duplicate delivery, so this is at-least-once delivery rather than guaranteed exactly once.

The worker polls every 15 seconds, processes at most 20 entries per tick, applies 10-second provider deadlines, checks receipts after 15 minutes and retries transient failures at most six times with bounded exponential backoff and jitter. `DeviceNotRegistered` removes the matching registration. Completed records expire after `COMPLETED_JOB_TTL_HOURS=24`; failures after `FAILED_JOB_TTL_DAYS=7` through Mongo TTL indexes (TTL deletion is asynchronous). A receipt confirms provider handoff, not that a human saw the notification. Monitor delivery status counts rather than tokens or message contents.

## Deployment and manual device checks

1. Create/configure an EAS project and Android/iOS development builds, add the matching Expo notification credentials and project ID, and request notification permission. Direct FCM/APNs integration is intentionally absent. Expo Go on Android does not support remote push from SDK 53 onward; this project's SDK requires a development build for that test.
2. Set `PUSH_PROVIDER=expo`; set `EXPO_ACCESS_TOKEN` if enhanced security is enabled. Keep credentials in deployment secrets. Confirm private database access and indexes before enabling workers.
3. On Android and iOS register the real Expo token with an authenticated account. Create an in-app notification and confirm its queue job, ticket and receipt transitions. Test foreground, background, locked-screen and temporarily offline states; verify notification text reveals no personal or health data.
4. Rotate/re-register the token, then process an old receipt and verify the new token remains registered. Log out and revoke the installation; confirm another user's credentials cannot revoke it or queue their notification. Reinstall and confirm `DeviceNotRegistered` removes the stale token.
5. Repeat with dry-run mode locally and confirm `dry-run-not-sent` rather than a claimed delivery. Verify record expiry after retention and device/job removal during account purge.

Automated local coverage: `npm test -- src/push/push.spec.ts`. No physical-device delivery or cloud credentials were available during implementation.

Sources: [Expo sending and receipts](https://docs.expo.dev/push-notifications/sending-notifications/), [Expo troubleshooting and Expo Go limitations](https://docs.expo.dev/push-notifications/faq/), [device setup](https://docs.expo.dev/push-notifications/push-notifications-setup/).
