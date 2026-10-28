# Phone notifications

The in-app inbox stores account notifications. A user can opt into a daily check-in at a chosen local time and enable phone notifications from the inbox. The backend creates reminders while its process is running and queues a generic, privacy-preserving push message for registered devices.

For remote delivery, configure an Expo EAS project ID in the mobile app configuration, configure the Android FCM and iOS APNs credentials for that project, create a development or production build, and set `PUSH_PROVIDER=expo` on the backend. The default `dry-run` provider does not deliver notifications. The user must grant operating-system notification permission. Expo Go does not support remote push in the current SDK. Verify delivery, notification taps, token rotation, and sign-out on physical Android and iOS devices before release.

The reminder worker runs in the backend process. It deduplicates each account's daily reminder and catches up within 15 minutes, but a longer outage can miss it. Push enqueue failures are logged and are not currently replayed. Do not treat push delivery as an emergency communication guarantee.
