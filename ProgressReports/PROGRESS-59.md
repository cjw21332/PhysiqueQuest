# PhysiqueQuest v4.0.0 progress report

Compared with `PhysiqueQuest-v3.1.2` (commit `31563dc`), the working tree contains the following changes. This is a local release review, not a certification that every integration or device works.

## Changes and additions

- Registration now requests an email verification code before onboarding, with shared email delivery, clearer validation, and registration-flow cleanup. Existing unverified accounts are prompted to verify.
- Food search and history presentation were updated, including USDA energy handling and tests for calorie values when energy is supplied in different forms.
- Coach screens received dark-theme styling, manual set logging, rest controls and a revised manual workout report. Camera preparation and nested screen routes were updated.
- Phiq adds a chat interface and Gemini-backed service with user-context handling, a privacy notice, error handling and conversation presentation.
- Profile photos can be managed from Account & Settings and are shown in the home avatar; exercise and food names receive presentation casing.
- Quests, eight displayed badges and the leaderboard received a dark-theme reference layout. Strength rankings derive from recorded sets, with heaviest-lift and bodyweight-relative views. Workout records feed personal-record and activity calculations.
- New nested routes reflect screens under Home, Coach, Scan, Quests and Me. The design document was updated for the revised interfaces.

## Verification and outstanding work

- Backend build and backend unit suite passed locally; the workout-connection test fixture was updated for the new activity dependencies.
- Frontend production build, mobile TypeScript and the mobile Node test suite passed. Selected browser checks covered the updated coach, profile, quest and chat interfaces; these use mocked data and do not prove real provider delivery.
- The complete frontend Node suite still has 13 failures. Several isolated-component test harnesses cannot load newly introduced CSS or TypeScript imports; other assertions still expect prior wording, navigation or camera/report presentation. These failures need investigation and correction before claiming a clean release.
- The Perfect Form badge is explicitly unavailable until reliable form scoring exists. Real email delivery, Gemini availability, live data workflows and physical mobile devices were not established by these checks. Existing deployment and security checklist limitations remain open.
- Ignored secrets and generated dependencies are excluded by Git; verify deployment configuration separately.
