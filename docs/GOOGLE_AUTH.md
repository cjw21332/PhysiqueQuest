# Google sign-in and registration

The login and registration pages use a Google account picker in the PhysiqueQuest native app and Google Identity Services in a browser. The backend verifies each Google ID token signature, expiry, issuer, verified email, and OAuth audience before creating or signing into an account.

## OAuth client configuration

Use the Google OAuth **Web application** client ID associated with `mobile/google-services.json` (OAuth client type 3). The current ID is configured for the web page, mobile app, and backend default. If the Google project changes, update all three:

- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in the frontend build environment.
- `googleWebClientId` in `mobile/app.json`, then create a new native build.
- `GOOGLE_WEB_CLIENT_ID` in the backend environment.

Add the deployed website origins to the OAuth client's authorized JavaScript origins. For Android, register package `com.physiquequest.app` and the signing certificate SHA-1 fingerprints in Firebase/Google Cloud. Native Google Sign-In requires a development or production build; Expo Go does not include the native module.

The provided Android configuration does not configure iOS OAuth. Before enabling native Google sign-in on iOS, create an iOS OAuth client, add its client ID/reversed URL scheme to the Expo Google Sign-In plugin configuration, and provide the matching `GoogleService-Info.plist`.

## Account lifecycle

Google registration requests a password first, sends an email OTP, and only creates the account after that OTP is accepted. The Google name and verified email are used to start the normal profile-calibration flow. If setup is interrupted after account creation, signing in with Google routes the user back to their unfinished profile. Existing accounts selected from registration are directed to Google login; Google login for an unknown account directs the user to register.

An existing email/password account with the same verified Google email is linked to that Google identity after the backend validates the Google token. Google account IDs remain bound to the user record so a different Google identity cannot later take over the link.

## Push notifications

Google sign-in and Expo push notifications use separate credentials. For push delivery, follow [PUSH_NOTIFICATIONS.md](./PUSH_NOTIFICATIONS.md); the Firebase service-account JSON belongs in Expo/EAS credentials and is not required by the backend Google token verifier.
