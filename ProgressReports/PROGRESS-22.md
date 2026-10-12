# Progress Report 22 — Repository Governance and Release Sync

**Scope:** Add mandatory cross-project rules, record the completed Notifications implementation in the checklist, and prepare the requested v2.6.0 branch/main delivery  
**Status:** Documentation updated; delivery will be verified by the resulting Git references.

## Summary

Added `GENERAL.md` as the governing rule for all repository work. It requires the frontend design, backend/database, and architecture/procedure documents to be followed together; requires a checklist review after every task; and defines when and how to create the next numbered progress report.

Updated the design and procedure documents to clarify their scope and link to the General Rule. Updated the database guide to identify its mandatory relationship to the other rule documents. The checklist now records the October 13 Notifications presentation update and its automated verification without marking the live end-to-end workflow complete.

## Verification and delivery evidence

- Frontend production build passed.
- Complete frontend test suite passed: 66/66.
- Backend production build passed.
- Complete backend test suite passed: 273/273.
- Checklist end-to-end notification criterion remains unchecked because no fresh live persisted-data round trip was performed.
- Branch and main push results are represented by the Git refs carrying this report; local automated checks do not certify a live deployment.
