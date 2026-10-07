# PhysiqueQuest Progress Report 9

## Delivered in this update

- Connected the Register form’s **Create account** action to the four-step calibration flow shown in the onboarding references instead of sending a new user directly to Home.
- Added **Step 1 · Personal Data** with age, height, weight, calculated BMI, gender, optional body measurements, and activity level.
- Added **Step 2 · Goals** with a primary training goal, optional target weight/date, and training commitment selection.
- Added **Step 3 · Training Preference** with equipment, training days, session duration, and phone-placement confirmation.
- Added **Step 4 · Health & Safety** with condition selection, optional health notes, and required emergency-contact name and phone number.
- Added step progress, validation, back/next controls, and responsive styling using the existing onboarding and design-system components.
- The profile is written to the existing local profile storage and the local prototype session begins only after the user completes Step 4. The expanded profile fields are represented in the shared `Profile` type.
- Updated `DESIGN.md` to describe the current registration-to-calibration sequence.

## Where to pick it up

1. Open `/register`, complete the account form and required consent, then choose **Create account**.
2. Complete the four calibration screens. Required personal measurements, at least one equipment option and training day, phone-placement confirmation, and emergency-contact details are validated before proceeding.
3. Finish calibration to save the profile locally and continue to `/home`.
4. Connect registration, profile persistence, and emergency-contact handling to the future authenticated API when the backend and Atlas environment are implemented.

## Current prototype limits

- Registration remains simulated; the password is validated in the form but no account credential or password is sent to a server.
- Calibration data is held in page state until Step 4 and then saved to this browser/device. Incomplete calibration is not resumed after a page reload.
- Emergency-contact data is stored locally with the profile; it does not trigger monitoring, location sharing, or emergency alerts.
- Calibration guidance and BMI are informational prototype behavior, not medical advice or a professional exercise prescription.

## Verification

- `npm run build` completed successfully, including TypeScript validation and Next.js route generation.
- No device-level or end-to-end browser test was run.
