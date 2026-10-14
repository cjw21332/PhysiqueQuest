# Nested-page back button placement — October 14, 2026

The requested back icon now appears immediately before the page name on section subpages.

- Reordered Coach Exercise Library, Scan Review Estimate, and Scan Food History header markup.
- Removed CSS ordering that moved Today's Log and Add Food back buttons after their titles. Left-aligned the Exercise Library and food headers and explicitly retained the shared Me edit header alignment.
- Audited nested Home, Coach, Scan, Quests, and Me headers. Added regression checks covering 15 page/shared-layout components and the affected CSS alignment. Existing parent-navigation handlers, trailing actions, API connections, and backend code are preserved.
- Recorded the header convention in DESIGN.md and reviewed the checklist without changing completion totals.

Verification: targeted navigation/style checks passed (6 tests); the complete frontend suite passed (76 tests); the frontend production build passed. No physical-device or live backend verification was performed for this presentation change.
