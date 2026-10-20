# Camera Readiness — UI Contract

## Scope and Source

Preserve the existing product records: root DESIGN.md, .agents/rules/DESIGN.md and existing CameraCheck.tsx. This is a behavior/copy contract for the current screen, not a visual redesign.

## Interaction and Copy

- Keep preview and four independent status rows: Camera connection, Full body in frame, Scene brightness, Framing.
- Each row renders text and an icon/status meaning: Checking / Ready / Adjust / Unavailable. Do not rely on color. Unknown maps to Checking only while work is genuinely pending; unsupported or failed maps to explanatory Unavailable.
- Framing copy says approximate guidance, never a measured meter distance. Scene brightness copy describes a coarse camera-image estimate, not a guarantee of form-tracking accuracy.
- Camera controls and explicit Continue without camera action stay available during pending/error states. Existing Start session continues without a readiness gate; camera-off continuation tears down camera resources.
- Announce meaningful stable summary changes through one polite live region; avoid announcements on every frame. Keep focus on the user's control and offer retry for recoverable errors.
- Keep existing Progress Green / Night / Steel / Warning Coral palette, tonal depth, restrained rounded controls and visible focus styles.

## UI Considerations

- [explicit] Every status has a visible text label and explanation; screen-reader feedback does not repeat per-frame output.
- [explicit] Manual continuation remains usable during all readiness states and does not require an external provider.
- [explicit] Controls retain at least 48px/dp hit targets and labels; large text wraps without clipping status or actions.
- [backstop] On actual Android/iOS devices, preview crop, orientation and mirroring agree with evaluated visible bounds; record device evidence before marking verified.
- [backstop] System font scaling, screen-reader navigation, thermal slowdown and background/reopen behavior remain usable on tested native builds.
