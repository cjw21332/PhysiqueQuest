# Me reference screens — October 14, 2026

Completed and refined the existing in-progress Me reference presentation without reverting prior work.

- Account & Settings retains dynamic profile data, authenticated role-gated admin tools, settings persistence, password recovery, logout, and alert actions. Added the existing read-only activity endpoint for the actual level and an explicit settings-load retry. Reference avatar artwork and the requested icon treatments match the supplied concept. The optional pre-existing sample preview remains labeled and local.
- Five editors share the reference header, quiet white fields, chips/cards, selected states, green accents, and pinned Discard/Save footer. Failed saves remain open and successful saves return to the account page. Personal data preserves metric/imperial units and computes BMI accordingly; Goals displays the saved target-weight unit.
- Training weekdays use one-letter labels with full accessible names; the selected-day summary is visually hidden. Added a shared phone-device icon for the placement note. Health checkboxes and account switches have rounded reference shapes. Relationship chips wrap like the supplied reference.
- Corrected inherited calibration padding, plain back-button styling, content gutters, and desktop edit-screen width. Existing safety alert testing remains available below the primary reference content; provider limitations are not represented as guaranteed alert/silent-mode override capabilities.
- Frontend only: no backend, API-client, schema, or dependency changes were made for this task.

Verification: all 85 frontend tests and the frontend production build passed. New component tests verify saved values, unit-aware BMI, and confirmed/rejected saves across all five editors. Fixture-based browser checks covered all six pages at 320×568, 390×844, and 1440×900, with no horizontal overflow and visible save footers. A local preview server outside the repository was stopped and its browser viewport/tab cleaned up. Live database, provider, and physical-device workflows were not tested. Checklist completion totals remain unchanged.
