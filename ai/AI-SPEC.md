# Phiq application and data contract

Phiq specializes local Qwen3.5 4B open weights through an application Modelfile, reviewed page knowledge, request-time retrieval and regression evaluations. No foundation-model training or database fine-tuning is performed. Personal account records never enter model weights or a shared embedding index.

## Page coverage

`backend/src/chat/chat-pages.ts` lists35 reviewed routes: every static app page and every allowed Home/Coach/Scan/Me subpage, plus Quests, leaderboard, Goals, Progress, Exercises, authentication and policy pages. Route-coverage tests compare this registry to the frontend's actual route files and dynamic view allowlists. Modal/tab features such as password/photo controls, custom dietary goals, meal schedule, rest timers and reminders are included in the relevant page guide.

A current-page hint accepts known paths only, never a URL or account selector. Explicit current-page questions use that hint; unrelated requests cannot inherit application scope merely by being asked on an app page. Reviewed page instructions return directly without a model or personal queries. Model context includes only relevant guides, not the entire site catalogue.

## Personal access

Explicit consent defaults off and is reset on account/session changes. Guidance and capability questions avoid personal queries even with consent. All collection queries use the authenticated owner ObjectId. Safe projections are followed by explicit nested mapping, string/numeric validation, instruction-shaped text filtering, date bounds and array limits.

| Source | Permitted own-account context |
| --- | --- |
| Profile/goals/training | Goal, target weight/date, height/weight, chest/waist/arms with units, activity, equipment, weekdays and duration |
| Requested private profile fields | Only the explicitly asked own-account name, age, gender, health conditions/notes, or emergency-contact name/phone/relationship; health and contact fields are consent-gated, field-projected, owner-decrypted and answered deterministically |
| Nutrition/dietary plan | Recent meal names/date/group/macros, water, saved calorie/macro plan and selected targets; exact daily and bounded calendar-period aggregates from all matching saved entries |
| Coach/workouts | Saved weekly plan, requested saved exercise instructions, active workout and recent completed sessions with bounded saved sets |
| Progress | Recent measurements per metric and latest available value per metric |
| Quests | Exact own XP/level, remaining XP, streak, missions and non-ranking badges using the existing app rules; bounded raw activity excerpts are labeled separately |
| Preferences | Selected inactivity, alarm, threshold, notification and leaderboard-visibility settings |
| Notifications | Recent titles/category/unread/time, total unread count and saved daily reminder time |
| Safety | Recent own event type/status/times only; no delivery guarantee |
| Admin/leaderboard | Page/rule explanations only; no other-account or organization-wide datasets |

Never retrieve credentials, session tokens, email, locations, photos, recordings, provider payloads or another user's records for the assistant. Health and emergency-contact fields are fetched only when the signed-in user has enabled personal-data access and explicitly asks for those fields; they are excluded from model prompts and answered only by deterministic formatters. Device drafts, live timers, raw camera/video and unsaved scan edits are unavailable. Existing record retention policies still apply.

The Quest helper skips leaderboard access completely and performs no writes. Current app streak calculation caps at365 days. Saved program versions may be stale; recent excerpt limits must not imply complete history. Null/missing/filtered fields are unknown. Current profile weight, measurement check-ins, target weight and goal are separate facts.

## Responses and latency

Common page instructions and exact supported profile/Quest/reminder values use deterministic answers. Other requests use compact retrieved context, concise generation, short-lived local-model metadata verification and warm model residency. No personal reply/context cache is shared between users. Client cancellation stops waiting and ignores stale replies; it does not promise to erase already dispatched server/runtime buffers.

Nutrition arithmetic distinguishes plan percentages/derived grams from independently saved settings and logged totals. Remaining amounts never become negative; over-target amounts are labeled. Period projections cover this/last week, month or year, past 1–366 days and inclusive explicit ranges up to 366 days, in the account's activity timezone; weeks start Monday. Water aggregates use the latest saved value per date. Averages state whether they divide by inclusive calendar days or saved meal entries. Missing or invalid inputs remain unknown. Current daily targets are not substituted for historical targets. Exact arithmetic, trend evidence limits, prescriptions versus recorded sets and unavailable live timers are handled deterministically rather than delegated to generation.

The semantic fallback handles new wording and new arrangements of familiar words. Direct record fast paths require a complete reviewed form rather than vocabulary membership. Unreviewed requests go to a local field selector whose schema permits only closed route IDs and timeframe values. Candidate constraints preserve literal evidence about record versus procedural intent, topic, consumed versus target nutrients, meal groups and measurement recency. The server fills explicitly named measurement slots and resolves a generic plan from a known Scan/Coach page; it never treats a page as authorization for unrelated content. Ambiguous or unavailable resolution yields a clarification without account retrieval. Only after a validated record selection and consent may own records be loaded. The selector receives no database values, user IDs, client assistant claims or tools. Its routing result is not an answer-value cache, and values are reread for each question.

Grounded JSON still validates internal source IDs, but visible source lists/footers are removed. UI renders ordinary text through React. Scope refusal, credential/other-user requests, medical boundaries and attempted mutations have fixed safe responses. The assistant has no database-query, file, shell, browser or mutation tools. Unknown fields/system roles and oversize requests are rejected.

Natural-language scope and factual reasoning remain probabilistic; internal source IDs do not prove entailment. Instructions/regex filters are defense in depth, not an authorization boundary. There is no promise of zero latency or perfect answers.

## Production controls

The API uses existing verified JWT/session identity. Account/IP request quotas use atomic MongoDB counters shared across replicas with hashed keys and TTL expiry. Failure of the shared quota store fails closed. Per-user active-request and per-runtime generation concurrency limits prevent local overcommit; aggregate capacity requires deployment sizing.

Only configured private inference endpoints are accepted. Explicit extra DNS names must resolve exclusively to private addresses on every connection; a validated address is pinned into the socket. Metadata checks reject remotely backed/cloud aliases before private content is sent, with a bounded short cache for a trusted local daemon. Redirects, public/metadata endpoints and arbitrary model registry paths are blocked.

Production prewarm is asynchronous; `GET /api/chat/status` is authenticated and reports only ready/not-ready. Inference startup, durable model storage, HTTPS gateway, frontend standalone output and GPU configuration are supplied in `ai/deploy/`. Operator secrets, real DNS, production infrastructure and staged host verification remain deployment inputs.

Chat content is transient browser/request/runtime memory. The endpoint does not save history or log prompts/replies; proxy/runtime operators must preserve this policy. OS administrators can access host memory. Existing application metadata/audit logs remain separate from conversation storage.

## Evaluation

Unit/HTTP checks cover page coverage, topic retrieval, opt-out, owner filters, projections, instruction-shaped records, invalid input, internal sources, response cleanup, model downtime, DNS rebinding, readiness, cancellation and quotas. Browser checks cover source suppression, current-page hints, consent, Stop waiting, retry, account replacement and stale replies. An isolated real MongoDB test verifies two users' fitness, Quest, notification and safety context without touching live account records.

`ai:evaluate` uses production classes, synthetic in-memory records and the actual installed model; it records direct versus generated latency in `evaluation-latest.json`. This is behavior tuning/regression evidence, not weight training or production load certification. Run it after knowledge, model, prompt or retrieval changes.
