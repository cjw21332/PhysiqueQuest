# PhysiqueQuest

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

The intended product has native Android and iOS interfaces that respect each operating system's conventions. This is the confirmed direction, not a claim that native migration is complete. Today, `frontend/` contains the mobile-first Next.js interface and `mobile/` provides an Expo/React Native shell that primarily displays it in a WebView with device integrations. This shared record applies to both apps.

## Users

People pursuing fitness goals who want an AI coach to manage their training, teach exercise form, track food and lifting progress, and help them follow a workout regimen consistently. Specific age groups, experience levels, and target markets remain undecided.

## Product Purpose

PhysiqueQuest is intended to act in place of an in-person fitness coach or practitioner for workout management and guidance. It helps users work toward their goals through a consistent workout regimen, form instruction, food tracking, and progress recorded in a database.

Success means users can follow their regimen consistently and see their recorded progress toward their own goals. Numerical success targets have not been established.

## Positioning

The confirmed product mechanism combines AI coaching, workout management, exercise-form guidance, food tracking, persistent lifting and goal progress, and competitive quests in one mobile application. No exclusive market advantage or validated coaching-equivalence claim has been established.

## Operating Context

Users review and follow their workout regimen, learn correct exercise form, record workouts and lifts, track food, review progress, and participate in quests. Competition is an intentional part of the system, alongside consistent personal training.

The existing main sections are Home, Coach, Scan, Quests, and Me. Existing authenticated APIs and database records support continuity between sessions.

## Capabilities and Constraints

- Product direction: AI coaching, workout management, form instruction, food tracking, competitive quests, and persistent tracking of lifts and fitness goals.
- Current architecture: Next.js/React frontend, Expo/React Native mobile wrapper, NestJS APIs, and MongoDB persistence. The native-interface direction does not authorize a migration during context initialization.
- Preserve existing user records, account ownership, workout history, goals, nutrition records, and API-backed persistence when changing interfaces.
- Use existing React hooks and persistence patterns. Introducing Redux or another state-management library requires approval under the repository rules.
- Product intent and implementation status must remain distinct. Provider-backed food recognition, form analysis, email, and emergency delivery depend on configuration and verification; never portray unavailable or unverified capabilities as working.
- The current checklist records camera-counting entry points as removed while retaining underlying capability files. Form-teaching intent must not imply that automatic camera assessment is currently available or validated.
- Native migration scope, timing, and implementation approach remain undecided.

## Brand Commitments

The product name is PhysiqueQuest. Quests and competition are confirmed parts of the product, alongside coaching and goal progress. Existing logo and app-icon assets are available; no new voice or visual direction was established by this initialization.

## Evidence on Hand

- `README.md`: architecture, main workflows, setup, and provider dependencies.
- `docs/checklist.md`: implementation status and dated verification evidence; historical checks are not fresh production or physical-device verification.
- `frontend/app/` and `frontend/sections/`: incumbent web interface and workflows.
- `mobile/app.json` and `mobile/package.json`: Android/iOS Expo configuration and current dependencies.
- `frontend/public/logo.jpg`, `frontend/public/physiquequest-icon.png`, and `mobile/assets/physiquequest-icon.png`: existing identity assets.
- No clinical validation, equivalence to a qualified practitioner, testimonials, or outcome benchmarks were confirmed in this initialization. Do not invent them.

## Product Principles

1. Make the next training action and its relationship to the user's goal clear.
2. Support consistent adherence through connected coaching, food tracking, and progress history.
3. Keep competitive quests grounded in recorded activity and personal progress.
4. Preserve user-owned history and distinguish recorded facts from estimates or unavailable analysis.
5. Deliver native Android and iOS experiences that respect each platform's interaction conventions.

## Accessibility & Inclusion

For the intended native interfaces, respect system text scaling, reduced-motion preferences, safe areas, accessible labels, and platform navigation. Use at least 44-by-44-point touch targets on iOS and 48-by-48-dp targets on Android. Product-specific accessibility requirements and a formal compliance target remain undecided.
