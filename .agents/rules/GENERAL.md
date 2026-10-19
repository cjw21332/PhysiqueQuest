---
description: Mandatory governing rules for all PhysiqueQuest work. Establishes the required design, database, and architecture rule documents, checklist maintenance, progress reports, and safe delivery.
---

# PhysiqueQuest General Rules

These rules apply to every change, review, test, documentation update, and delivery in this repository. They are mandatory and take precedence over convenience or speed. Follow the applicable domain rule documents together with this General Rule.

## 1. Required Rule Documents

Before changing code or making decisions, read this document and the relevant domain rule document. For work spanning multiple domains, read every applicable document. Do not begin implementation until the constraints are understood.

| Rule document | Domain and authority |
|:--|:--|
| [`DESIGN.md`](./DESIGN.md) | **Frontend:** visual design, interaction, responsive behavior, accessibility, and how API states are represented in the UI. |
| [`DATABASE.md`](./DATABASE.md) | **Backend/data:** persistence, API/data contracts, database modeling, security, and backend data ownership. |
| [`backend.md`](./backend.md) | **Backend/mobile loading:** device snapshots, parallel reads, invalidation, service startup and verification. |
| [`PROCEDURES.md`](./PROCEDURES.md) | **Architecture and engineering process:** repository structure, cross-layer boundaries, implementation workflow, testing, and safe change procedures. |

All three documents are mandatory, not optional suggestions. The General Rule defines shared governance; the domain documents define their respective technical details. If documentation conflicts with implemented behavior, verify the code and tests, then correct the stale documentation rather than bending working code to an outdated rule. Never use this conflict rule to bypass security or an explicit user constraint.

## 2. Protect Project Constraints and User Work

- All frontend routes, dialogs and native host surfaces now use DESIGN.md's exact system-wide dark palette. Keep one authoritative token set in theme.css; do not reintroduce light route fallbacks or per-section color copies. Theme updates preserve existing geometry, typography and application flows.

- The approved Quests/account dark references authorize scoped presentation changes, including the five profile editors. Preserve runtime rankings, badges, profile values, safety settings and all existing navigation/save/discard behavior; screenshot examples do not authorize new penalty rules or fabricated records.

- The October 19 Nutrition and safety references authorize visual layout/type changes only. Keep the original navigation, API requests, validation, countdown timing, alarm audio, hold-to-stop behavior and admin permissions. Preserve truthful runtime text where screenshot examples would claim unverified delivery or device capabilities.

- Follow the repository's `AGENTS.md`, this rule set, and package-specific instructions. Preserve the monorepo boundaries and existing architectural choices.
- Inspect files before editing. Make focused changes, preserve unrelated user work, and do not discard or overwrite unrequested changes.
- Theme changes preserve the established layouts, typography, button placement, navigation, validation and data behavior unless the user explicitly requests a redesign. Dark mode is the approved default; retain its palette while restoring missing Back, Clear, Close, edit and completion controls. A screenshot reference is visual guidance, not authorization to remove working actions or replace API data with examples. Apply this rule across sections, including future theme passes.
- Keep credentials, tokens, environment files, and other secrets out of source, logs, reports, commits, and tool output. Respect `.gitignore`; do not force-add ignored files.
- Do not add dependencies, alter project structure, or introduce new frameworks without the required approval.
- Make errors visible and actionable. Do not silently replace failed API or persistence behavior with fabricated success or user data.
- Keep documentation accurate to the repository. Distinguish implemented behavior, automated evidence, live-service verification, and device/provider verification.

## 3. Checklist Review After Every Task

At the end of every task, re-open `docs/checklist.md` and compare the completed work to its modules, functions, and verification criteria.

1. Update relevant descriptions, evidence, status marks, dates, and summary totals when the work satisfies a criterion.
2. Only check a criterion when its own evidence threshold is met. Source inspection, mocked tests, or a build do not prove live API/database behavior or physical-device behavior.
3. Keep unverified deployment, provider, database, and end-to-end criteria unchecked, and state what evidence remains necessary.
4. If no criterion changes status, still review the checklist and add a concise dated note only when it materially improves traceability; do not churn unrelated checklist text.

## 4. Significant Task Progress Reports

When a substantial feature, multi-file behavior change, architecture/data change, or other heavy task for the day is completed, create a report in `ProgressReports/` named `PROGRESS-N.md`.

- Determine `N` by finding the highest existing numeric `PROGRESS-*.md` report and using the next number. Never overwrite, reuse, or skip an available next number.
- Record the task scope, user-visible/system behavior changed, important files or areas affected, verification run and its result, and anything not verified.
- Keep claims factual: automated checks are not live deployment verification. Do not put secrets or sensitive user data in reports.
- Preserve existing report contents. Reports belong only in `ProgressReports/` and use the exact `PROGRESS-N.md` naming format.

Small, isolated, low-risk edits do not require a standalone progress report unless the user requests one.

## 5. Verification and Completion

- Run the smallest relevant existing tests first; expand to the suite/build when appropriate to the affected surface.
- Re-run affected checks after the final edit. Review `git diff --check` and inspect the final diff for accidental or unrelated changes.
- For documentation-only tasks, validate links, numbering, consistency, and checklist/report claims; do not claim code tests ran unless they did.
- State verification results and meaningful limitations clearly. Do not claim a task, workflow, or deployment is fully working beyond the evidence gathered.
- Do not publish, commit, or push unless requested. When requested, respect `.gitignore`, inspect the exact staged changes, and confirm the target branch and remote outcome.
