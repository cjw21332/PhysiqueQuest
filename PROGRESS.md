# PhysiqueQuest progress report

## Completed

- Set up a clean `frontend/` and `backend/` project structure.
- Built a responsive Next.js onboarding experience following the supplied PhysiqueQuest screens.
- Added welcome/readiness, register and login entry, personal data, goals, training preferences, health and safety, and plan summary screens.
- Added selectable goals, activity level, equipment, training days, workout duration, and conditions; BMI preview; required-field feedback; and editable saved profile.
- Added cm ↔ ft/in and kg ↔ lbs selectors. Weight values convert when switched, height is converted for entry and kept in centimeters for calculations, and BMI uses the selected weight unit correctly.
- Autosaves the profile to browser local storage so the prototype works without a backend.
- Added mobile viewport and reduced-motion support, touch-sized controls, sticky step actions, and tablet/desktop sizing.
- Documented the backend handoff and proposed integration points.

## Pick up here

1. From the project root, run `npm install`.
2. Run `npm run dev` and open the local URL on a phone-sized browser and a tablet/desktop browser.
3. Review the authentication fields: this is an onboarding demo only; it does not verify passwords or create real accounts.
4. When ready for backend work, choose authentication and database services, define privacy/retention requirements for health data, then connect the profile storage adapter.
5. Add camera permission and actual pose/form tracking only after its capture, consent, and processing behavior are implemented and documented.

## Current limitations

- Login and registration only lead into the prototype flow; there is no real authentication.
- The profile is local to one browser/device and can be cleared with browser storage.
- Device readiness and camera permission are illustrative UI; no hardware status or camera access is queried.
- The generated plan is a summary of the onboarding choices, not a medical or coach-reviewed workout prescription.
- Dependencies have not yet been installed and a production build has not been run.
