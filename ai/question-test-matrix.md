# Phiq question regression matrix

The executable corpus lives in `backend/src/chat/chat-question-corpus.ts`. Its current 229 distinct cases cover normal user phrasing, current-page help, account data, follow-ups and safe failure behavior. This inventory describes what is checked; the repeated-run results are recorded separately. No finite corpus proves correctness for every possible question or makes the assistant perfect.

## Cases and runner contract

| Outcome | Count | Expected behavior |
| --- | ---: | --- |
| data | 157 | Read only consented own-account records; answer the requested facts, with correct field meaning/units |
| guide | 44 | Explain real application controls and pages without requiring personal-data consent |
| consent | 10 | Ask to enable personal context; do not label an app question out of scope or leak fixture facts |
| missing | 6 | Use an empty synthetic account and explain unavailable records without invented values |
| boundary | 10 | Preserve other-account, secret, medical, read-only and unrelated-topic boundaries |
| clarify | 2 | Clarify an unspecified plan or an invalid calendar date before retrieval |

The corpus includes 14 multi-turn conversations and one partial-data case. Guide coverage includes every one of the 35 registered route paths, plus important nested controls such as rest, dietary macro totals, meal schedule and password changes. Every one of the 157 personal-record cases is also tested with consent off to verify that no database reads occur.

Each corpus case also runs through five wording transformations: uppercase, lowercase, a polite prefix, extra whitespace and curly apostrophes. The original case plus those five wrappers produce **229 × 6 = 1,374 phrased checks**. These are repeated phrasings of 229 semantic cases. Each phrasing now has its own Vitest declaration and the same fact, forbidden-claim, source, consent and owner checks; a failure no longer prevents the remaining variants from running.

The runner should use synthetic fixtures only. `scenario` is populated unless explicitly empty or partial. `conversation` already includes the final user question. Do not append that question again. `sourceIds` are acceptable alternatives: at least one must support the answer. `requiredTerms` regex strings are ANDed with case-insensitive matching; none of the `forbiddenTerms` may match. The runner should also verify requested fixture values, source isolation and no visible source footer; merely avoiding a refusal is not enough.

Useful populated fixture fields include a saved diet plan with distinct calorie/macro percentages, independent profile current/target weight and date, newer Progress check-ins, a weekly program with training/rest days, an active/paused workout, completed set results, Quest total/within-level/remaining XP, unread notifications with reminder timezone, selected safety preferences, and a delivery event. Empty and partial fixtures must distinguish missing from zero and from an unavailable database.

## Confirmed failure patterns from the read-only audit

| Priority | Example | Observed failure before the fix | Correct behavior |
| --- | --- | --- | --- |
| 1 | “what’s my current diet plan?” | Personal-intent classifier and scope/page matcher miss diet/plan, returning generic out-of-scope text before retrieval | Read the saved plan with consent; otherwise explain consent; acknowledge no saved plan if empty |
| 1 | “Tell me about my current Coach program” | Fast guide route consumes a personal-record request and returns only generic page instructions | Summarize the user’s saved program |
| 1 | “Explain my settings” | Same guide/personal collision | Show selected allowed saved settings, with consent |
| 1 | “What are my total quest points?” | Direct response uses today’s earnedPoints instead of all-time experience | Distinguish all-time total, within-level earned XP, remaining XP and today’s mission points |
| 2 | “What are my macros?” | Personal-data intent misses macros | Use saved plan/targets and label percentage versus grams |
| 2 | “What have I eaten today?” | Eaten is missing from lexical scope/personal intent | Show available saved today entries, with date/timezone and bounded-history caveats |
| 2 | “Which badges have I earned?” | First-person intent requires my rather than I | Show own calculated badges; ranking-dependent badges remain unavailable |
| 2 | “What time is my daily check-in?” | Check-in synonym misses personal intent | Return saved reminder time and timezone |
| 2 | “Where am I in my weight goal?” | Any where question is treated as navigation help | Compare actual current/target records; do not invent a starting weight or completion percentage |
| 3 | “What is my target date?” | Also prints target weight even when only the date was requested | Answer the requested date directly |
| 3 | “And the calories?” after a diet question | Follow-up semantics depend on retaining the previous topic | Resolve the diet topic and retrieve only its allowed records |
| 1 | “What is my current plan?” on `/scan` versus `/coach` | Page-aware classification was lost when the exact-answer helper reclassified without the page | Use the known page to choose the dietary plan or Coach snapshot; clarify when neither page nor question identifies a plan |
| 1 | “What is my daily calorie goal?” | Singular calorie missed nutrition routing and returned the profile’s fitness goal | Normalize singular/plural calorie and kcal wording and return the saved dietary calorie target |
| 2 | “Explain quantum physics” or “What is the capital of France?” on `/scan` | A generic explanation request fell back to the current page’s guide | Refuse the unrelated topic without a personal-data read; a page hint must not manufacture application relevance |

The 30 October expansion reproduced 33 failing semantic cases in its first new batch, then additional chained-follow-up, compound-duration, meal-group/count, range-history and average failures. Actual model evaluation also caught a plan/settings substitution (2,100 versus 2,000 kcal), an incorrect protein-goal claim (90 g logged versus 150 g target), unsupported trend wording and prescription/load assumptions. The first failed synthetic report is retained in `question-evaluation-before-hardening.json`. Exact saved-record calculations and evidence limits now run deterministically; open-ended explanation probes still exercise the real installed model. The final focused chat run passed 1,712 tests, including all wording variants, consent-off variants, HTTP integration and missing/invalid-record checks.

New factual checks distinguish saved plan versus independent settings; daily target, logged intake, remaining and averages; multiple meal groups and water in one question; current profile versus multiple latest Progress metrics; planned versus completed duration; training preferences versus program snapshots; earned versus remaining XP; and consecutive short follow-ups on actual page hints. Complete date-range nutrition totals use database projections over all matching saved entries. Supported periods are this/last week, month or year, past 1–366 days, and explicit inclusive ranges up to 366 days. Weeks start Monday. Calendar-day averages include dates with no saved logs and state that denominator; per-entry averages use the full saved entry count. Current daily targets do not establish historical targets for a period.

## Accuracy checks worth keeping separate

- Diet percentages are stored in `nutrition.dietaryPlan`. UI gram targets derive protein/carbs as calories × percentage /400, and fats as calories × percentage /900, rounded as the UI does. Do not label stored percentages as grams.
- The dietary plan’s saved activity value exists in the schema/UI. Before this audit it was omitted from assistant context, so asking about that value cannot be answered faithfully unless it is explicitly included or marked unavailable.
- Nutrition targets in Settings can differ from a saved dietary plan. Match the source to the user’s question and the UI’s precedence; do not merge them silently.
- Current profile weight differs from newer measurement check-ins, target weight and the fitness objective.
- Today’s points differ from total Quest XP, and currentExp differs from XP remaining.
- Missing raw records do not prove zero activity; truncated recent excerpts cannot establish all-time totals.
- A direct-answer path that returns after the first topic can silently omit the second half of a mixed request. Either answer both supported topics or state the limitation; do not score a partial answer as full success.
- Guide questions such as “How do I change my goal?” must remain guide-only, even though the word my appears.
- Consent-off questions should remain recognized as application questions.
- Tests should include page context and no-page context; page context must not authorize an unrelated topic or another account.
- Hidden metadata validation and source display are separate: preserve internal grounding while keeping Sources footers out of the reply.

## Retest workflow

First reproduce the reported sentence with the actual ChatService path. Then run the corpus against direct answers and actual retrieval fixtures, fix failing categories, and repeat. Use real local-model evaluation for reasoning requests that still reach generation, including multiple paraphrases of a topic rather than only generic current-page prompts. Finish with backend tests/build, relevant browser checks, and two-account database isolation.

From `backend/`, run the focused service, intent, corpus and accuracy checks:

```powershell
rtk npm test -- --run src/chat
```

From the repository root, run repeated evaluation using synthetic records and the actual installed local model where generation is required:

```powershell
rtk npm run ai:evaluate:questions
```

The runner defaults to three passes. It combines the 229 corpus cases with 23 reasoning probes: 1,374 corpus phrasings plus 23 reasoning probes, or 1,397 checks per pass. The 30 October run passed **4,191/4,191 synthetic responses**, with **15 actual model generations**; that historical report is preserved as `ai/question-evaluation-2026-10-30.json`. Numerical analytics and known evidence limits use deterministic answers. The runner writes `ai/question-evaluation-latest.json`, and separately records direct answers, semantic route selections and answer generations. This does not certify every possible question, production latency or live deployment.

## Meaning-based fallback — 31 October 2026

Normalization wrappers do not establish synonym coverage. The semantic resolver now receives every unreviewed complete wording, including new arrangements of familiar words. It selects a validated closed route and timeframe; account values come from fresh authenticated retrieval and deterministic formatters. The model cannot choose owners, database fields, queries or mutations. Ambiguous or unavailable interpretations ask for clarification before reading account records. Tests separately verify consent, account isolation, selected source domains, malformed responses, forged assistant history, unavailable inference and concurrent requests.

The independent paraphrase runner contains 38 probes with substantially different wording: energy allowance, eating blueprint, mass, training implements, latest sweat session, experience shortfall, indirect autobiography, mixed topics and unclear/unsupported requests. A separate local-model writing step supplied 12 additional questions saved in `generated-paraphrases-latest.json`. They were reviewed against their source intent: one changed glass count to ounces, and another explicitly requested exercise detail. Those cases now require an honest missing-volume explanation and actual exercise names, respectively. Generated questions are test inputs, not new production rules or model training data.

```powershell
rtk npm run ai:evaluate:paraphrases -- --passes=2 --replay-fresh
rtk npm run ai:evaluate:questions -- --passes=1 --original-only
```

The first command checks 50 questions twice, including the saved 12 generated questions. The second checks each of the 229 corpus intents and 23 reasoning probes once, using the real semantic model when appropriate. Native-model results are separate from Vitest's 1,374 deterministic wording checks; see `VERIFICATION.md` for the final counts. Neither a repeated finite suite nor schema-valid output guarantees correct interpretation of every unseen question or language.

From `frontend/`, run the targeted chatbot browser checks:

```powershell
rtk npx playwright test --config playwright.chat.config.mjs
```

The chat browser checks cover the visible chat flow, consent, current-page hints, hidden sources, cancellation, stale replies, account changes, and responsive consent/composer layout. An unavailable local model, database failure or wrong account must never be hidden by a passing wording test.

Keep per-case outcomes, actual execution counts and timings in the synthetic report. State remaining limitations explicitly; do not claim every possible question has been tested or declare the assistant perfect from a finite set of passing examples.
