# Emergency alarm

This local Expo module plays a looping emergency tone using Android's alarm
audio stream. It sets that stream to its maximum while the alarm runs and
restores the previous alarm volume when stopped. Media volume and ringer volume
do not control this stream. Do Not Disturb, fixed-volume devices, audio routing,
and manufacturer restrictions can still affect audible output.

The inactivity threshold defaults to 30 seconds for accounts without a saved
preference. Account & settings → Inactivity threshold still saves 30, 45, or 60
seconds per account. The separate 30-second “I'm okay” countdown is unchanged;
the alarm continues until the user holds the stop control.

## Run on Android

Custom native modules require an Android development or production build; they
cannot be added to Expo Go by refreshing JavaScript.

With Android Studio's SDK and a connected Android device configured, run from
the repository root:

```powershell
cd mobile
rtk npm run android
```

For later development sessions using that installed build:

```powershell
rtk npm run start:tracking
```

Expo autolinking discovers this module in `mobile/modules` automatically. No
database migration or change to existing saved thresholds is needed.

## Device check

1. Use an account with no saved threshold and confirm 30 s is selected. Change
   it to 60 s, reopen settings, and confirm the preference is retained.
2. Note the device's alarm volume, then lower both alarm and media volume to
   zero. Start a workout, keep the phone still for the selected threshold, and
   let the separate 30-second cancellation countdown finish.
3. Confirm the native alarm sounds and the device's alarm volume is at maximum.
   Location permission must not delay the sound.
4. Hold the stop control for three seconds. Confirm sound stops and the original
   alarm volume is restored. Repeat with a page reload and app close.
5. Check the intended phones with silent mode, Do Not Disturb, Bluetooth, and
   headphones. Device policy and routing can limit or redirect alarm output;
   this app does not override those protections.

On iOS, browsers, and Expo Go, playback uses the existing browser alarm at full
application gain but remains limited by system volume. iOS does not provide an
API for this app to force the user's system volume to maximum.
