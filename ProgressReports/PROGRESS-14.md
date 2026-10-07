# Progress Report 14

**Release branch:** `PhysiqueQuest-v2.4.0`  
**Report date:** 2026-10-08

## Overview

This update completes a broad authentication and account recovery pass across the web client, API, and MongoDB-backed account data. It brings the sign-in and registration experiences closer to the supplied mobile modal designs, adds a three-step password recovery flow, strengthens duplicate-account and failed-login handling, and fixes a production backend entry-point path.

## Frontend experience

- Added outcome dialogs for failed sign-in, an email already tied to an account, and successful account creation. Dialog actions lead to the relevant next step, including trying another email, signing in, retrying, and starting calibration.
- Registration normalizes and validates the email address, prevents repeated submission while a request is active, and routes duplicate-email API responses to the matching dialog. The email can be cleared and focused directly from that dialog.
- Added a three-step password recovery modal: request a code by email, enter a six-digit code in a separate verification modal, then create and confirm a new password. The verification UI supports individual digit entry, paste, keyboard navigation, and a 60-second resend countdown.
- Added show/hide controls for both new-password fields and refined modal sizing, colors, typography, spacing, focus states, and responsive styling to match the supplied visual references.
- Kept profile calibration errors visible so a failed profile save can be retried without losing the registration context.
- Expected client-handled HTTP errors, such as an already-registered email, are no longer reported as network failures in the browser console. Transport failures and server errors remain logged.

## API and authentication changes

- Added a password-reset verification endpoint and changed password reset confirmation to accept a six-digit code.
- Recovery codes are hashed before storage, expire after 30 minutes, and are consumed once when a password is changed. Requests are rate-limited to one per 60 seconds, and responses for unknown email addresses remain account-neutral.
- Registration normalizes email addresses and relies on the database unique constraint, including duplicate-key handling for concurrent registrations.
- Added failed-login counters and a 15-minute sign-in pause after five invalid password attempts; successful authentication clears the counter and pause.
- Database configuration now requires `MONGODB_URI` at startup, giving a direct configuration error when it is missing.
- Corrected the production start script to launch the generated `dist/main.js` entry point.

## Database and email delivery notes

- User email fields are trimmed, lowercased, and unique in MongoDB. Recovery-token records now include timestamps used by resend throttling and expiry handling.
- When email delivery is configured, recovery codes are sent through the email provider. When delivery is unavailable, development mode returns the code and logs it to the backend for local flow verification. Configure email delivery before exposing password recovery in production; the development fallback is not a production email-delivery mechanism.
- Existing account documents are not rewritten by this change. MongoDB must have the unique email index successfully initialized for registration to proceed.

## Verification

- Frontend production build completed successfully on Next.js 16.3.8, including TypeScript checks and static page generation.
- Backend recovery service and frontend recovery-flow checks were updated alongside the implementation. A full backend test run was not performed as part of this release preparation.

