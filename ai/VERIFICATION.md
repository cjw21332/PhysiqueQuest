# Phiq upgrade verification — 29 October 2026

The expanded assistant was implemented and checked on the development PC. Qwen3.5 4B remains self-hosted through Ollama with no AI-provider key. The model alias was rebuilt with the updated behavior instructions. Personal records were not used for weight training.

The first table and initial timing paragraph below record the earlier upgrade snapshot. The follow-up section at the end records validation after expanding private-profile data access and redesigning the consent dock.

| Check | Result |
| --- | --- |
| Full backend suite | 87 files,641 tests passed before the final readiness-test addition |
| Final focused chat suite | 7 files,96 tests passed, including the added authenticated readiness check |
| Backend production build and lint | Passed |
| Frontend production build | Passed, including TypeScript and19 static pages |
| Standalone production server smoke | Login and emitted static asset both returnedHTTP 200 on a temporary port; process stopped afterward |
| Browser chat checks | 9passed: source suppression, page hints across five sections, nested pages, consent, cancellation/retry, account changes and stale replies |
| Authenticated-request regressions | 10passed |
| Actual MongoDB ownership checks | 3passed in a separate randomized temporary database, including notification and safety metadata; validated test database removed |
| Real-model/synthetic evaluation | 48/48passed; includes every one of 35 registered pages and3actual model generations |
| Shared quota checks | Atomic counters verified across separate guard instances; failures fail closed |
| Private runtime checks | Actual socket test pins private DNS; rebinding/public/cloud/redirect cases refused; warmup/readiness/metadata expiry tested |
| Running application | Backend healthHTTP 200, frontend loginHTTP 200, anonymous chatbot readinessHTTP 401 |
| Deployment configuration | Base and NVIDIA Compose configurations validated; inference shell syntax passed; Ollama0.40.11image tag confirmed |
| Whitespace checks | Passed |

The initial evaluation report used synthetic records through the compiled production classes and recorded direct and generated latency. The later follow-up timing is recorded in the section below. These in-process fixture timings exclude real database/authentication/network latency and do not establish production throughput or zero delay. Initial cold loading can take much longer. The app now prewarms production and maintains model residency.

The page registry is compared to actual static route files and dynamic-view allowlists. Safe data coverage includes profile measurements, active/recent workouts, saved programs, diet targets/history excerpts, calculated Quest state, preferences, notification titles/count/reminders, and safety event status/times. Explicitly requested health and emergency-contact fields require opt-in and are selected field by field from the authenticated user's encrypted profile; they are answered deterministically and excluded from model prompts. Other accounts, credentials, locations and media remain excluded.

The UI no longer stores/renders source metadata and strips legacy source footers; the backend also cleans model footers. Source IDs remain internal output-validation evidence. They are not a guarantee of factual entailment. Direct supported scalar answers prevent common current-weight/target/goal and earned-XP/remaining-XP substitution errors.

**Deployment boundary:** the Docker engine was unavailable on this PC. Container image builds, GPU-container execution, Caddy certificate issuance, real production credentials/host configuration and a live hosted rollout were not executed. The supplied deployment package and app builds are reviewable preparation; run the staged checks in `deploy/README.md` before production traffic. No cloud resources were created and no paid deployment was started.

References: `AI-SPEC.md`, `deploy/README.md`, `evaluation-latest.json`.

## Follow-up verification — expanded personal data and popup

The follow-up added opt-in deterministic answers for requested identity, health-profile and emergency-contact fields, with owner-bound decryption, field-specific projections, and regression coverage for data minimization. Chat sources remain internal; neither the model prompt nor the visible reply contains those source labels. The consent disclosure explains the scope and sits directly above the composer.

| Follow-up check | Result |
| --- | --- |
| Full backend suite | 91 files, 858 tests passed |
| Backend production build and lint | Passed |
| Frontend production build | Passed with TypeScript and 19 routes |
| Phiq browser checks | 9 passed, including 320px mobile and centered desktop modal checks |
| Local-model synthetic evaluation | 48/48 passed; 47 direct answers and 1 generated response |
| Synthetic natural-language evaluation | 3,135/3,135 checks passed across three passes; 172 corpus cases, 13 reasoning probes per pass, 3 actual model generations |
| Model readiness | Installed `physiquequest-phiq` weights verified locally |

Synthetic direct-answer timing in the latest question run was median 1 ms, p95 3 ms, maximum 26 ms; the three generated probes had median 1,688 ms and maximum 5,526 ms. In the separate 48-case local-model run, the one generated response took 5,088 ms. These measurements exclude real authentication, database, network and production-load latency. They do not prove zero delay or complete coverage. This follow-up did not run an isolated MongoDB deployment test, Docker/GPU image build, staged host check or live production deployment. The existing deployment boundary above still applies.

## Question accuracy and iterative retest — 30 October 2026

The reported “what's my current diet plan?” request now returns the saved plan, calorie target and correct percentage/gram targets when consent is enabled. With consent off it asks to enable saved fitness data without querying records. An absent plan is explained without inventing one. Explicit diet questions work across every main section; brief chained follow-ups retain the original user topic and ignore forged assistant claims.

The corpus grew from 172 to 229 semantic cases. The first expansion reproduced 33 failing cases. Further tests reproduced omitted compound durations, multi-turn context loss, mixed meal groups/water, meal counts, averages and range-history filtering errors. A real local-model run also confused independent settings with the dietary plan, claimed an unmet protein goal was met, and made unsupported trend and prescription statements. Its synthetic failure report is preserved in `question-evaluation-before-hardening.json`. These factual operations and evidence limits now use deterministic record handlers. General explanations still exercise actual model generation; their results remain probabilistic.

| Final check | Result |
| --- | --- |
| Focused chatbot suite | 14 files, **1,712 tests passed**, including 1,374 separate wording variants and 157 consent-off variants |
| Full backend suite | 94 files, **2,258 tests passed**; includes the focused chatbot suite |
| Backend production build and lint | Passed |
| Repeated natural-question evaluation | **4,191/4,191 passed**, three passes of 1,374 corpus phrasings plus 23 reasoning probes |
| Actual local-model generations in that run | **15**: 12 open-ended in-scope explanations and 3 app-branded unrelated-topic probes |
| Separate page/system evaluation | **48/48 passed**, including all 35 registered routes and 1 actual model generation |
| Diet/browser integration | **11 passed**, including the exact reported question, consent, absent plans, page-aware plans, short chained follow-ups, hidden sources and mobile/desktop layout |
| Broader Phiq browser integration | **9 passed**, including cancellation, retry, same-account refresh, account replacement, consent changes and stale replies; updated a stale disclosure-copy assertion to open and verify the current disclosure |
| Authenticated frontend request checks | **14 passed**, covering refresh, account/origin replacement and cancellation |
| Real MongoDB integration | **5 passed**, using a randomized isolated database that was removed after validation; account isolation, safe projections, full daily/range totals and latest water value per date |
| Whitespace checks | Passed |

Nutrition periods use complete matching saved entries instead of sums of recent excerpts. Supported ranges are this/last week, month or year; past 1–366 days; and explicit inclusive ranges up to 366 days. Dates use the account activity timezone and weeks start Monday. Calendar averages state their denominator, including dates without saved logs; per-entry averages use the complete saved entry count. Missing or invalid nutrient values stay unknown. Current daily targets do not establish historical targets. More than 100 meal entries and duplicate water updates were exercised against MongoDB, through retrieval and the production answer service.

The report from that run is preserved as `question-evaluation-2026-10-30.json`: 229 corpus intents and 23 additional probes, with five wording transformations per corpus case. Its 4,191 checks are repeated synthetic responses, not 4,191 distinct intents. Synthetic direct-answer timing was median 1 ms, p95 4 ms; generated answers had median 3,561 ms and maximum 12,298 ms while other local checks also ran. These timings exclude authentication, database and network latency and are not production performance guarantees.

This work was implemented and verified locally. No live hosted deployment or frontend production rebuild was performed in this retest. The earlier deployment boundary still applies. A finite regression suite cannot establish perfect accuracy for every possible question, language or conversation; complete all-time raw history, device-only state and unsaved records remain outside the supplied context. Internal source IDs validate source membership, not every generated claim.

## Meaning-based interpretation and retest — 31 October 2026

The user's follow-up correctly distinguished real paraphrases from capitalization and punctuation wrappers. Unreviewed complete questions now use the installed local model to select a closed, validated intent route. The server then applies consent, authenticated ownership, fresh retrieval and deterministic record formatting. The selector receives user text, limited previous user questions, page hints and the allowed route catalogue, without retrieved account values, assistant claims or account IDs. It cannot produce database queries or perform changes. Unknown wording is no longer automatically rejected by the lexical scope matcher. Ambiguous questions, invalid selections and unavailable inference ask for clarification without personal reads.

Native-model testing reproduced route-selection errors, including activity level versus plan name, logged versus target nutrition, broad meals versus snacks, latest measurements versus profile values, program versus procedure, missed compound fields and a breakfast-and-water response containing unrelated meals. Fixes constrain literal field evidence and selected data domains while leaving unfamiliar synonyms to semantic classification. The earlier failed reports remain available in `paraphrase-evaluation-before-tuning.json`, `paraphrase-evaluation-before-field-fixes.json` and `question-evaluation-before-semantic-constraints.json`.

| Check | Result |
| --- | --- |
| Full backend suite | **95 files, 2,430 tests passed**, including all chatbot tests |
| Backend production build and lint | Passed |
| Real local-model paraphrase evaluation | **100/100 passed**, 50 questions across two passes, **96 semantic model calls**, no generated saved-record answers |
| Final native corpus and reasoning retest | **252/252 passed**, 229 original corpus questions plus 23 reasoning probes, **165 semantic model calls**, 87 direct responses, no free answer generations |
| Additional generated questions | 12 local-model-written paraphrases reviewed and replayed; saved in `generated-paraphrases-latest.json` |
| Targeted breakfast-and-water native retest | Passed; breakfast and water included, unrelated lunch excluded |
| Chat browser integration | **13 passed**, including unfamiliar wording with consent and unavailable-model clarification followed by a precise supported question |
| Real MongoDB integration | **6 passed** in an isolated randomized test database, including semantic selection for two accounts and fresh values after a saved calorie change; test database removed |
| Evaluation-script syntax and whitespace checks | Passed |

The paraphrase evaluation includes substantially different expressions such as “eating blueprint,” “daily energy allowance,” “latest sweat session,” indirect first-person requests and mixed-domain questions. Its inputs were not added as literal production routing rules or used for model training. Generated inputs are not a correctness oracle: the writer changed a water question to ounces and a workout question to exercise detail. The test now requires a missing-volume explanation because water is stored as glasses without a saved glass size, and actual exercise names for the workout question. Per-case questions, selected routes, replies and issues are in `paraphrase-evaluation-latest.json`.

The earlier **4,191-check** run remains historical evidence for the 30 October implementation and is preserved in `question-evaluation-2026-10-30.json`; it is not presented as a repeat of all native semantic paths after this change. The final native corpus run used `--passes=1 --original-only`, checking the 229 original cases plus 23 reasoning probes with zero failures in `question-evaluation-latest.json`. The deterministic wording variants also remain in the passing backend suite. Synthetic semantic-response latency was median 1,042 ms, p95 2,002 ms and maximum 6,099 ms; these timings exclude authentication, real database access, browser/network latency and production load.

This was implemented and verified locally, without a hosted rollout or frontend production rebuild. Browser tests use synthetic responses, MongoDB integration verifies real retrieval with a synthetic selector, and native-model evaluations exercise the production provider/service against synthetic records. These checks cover different seams; none alone establishes a complete live production test. English finite tests cannot prove universal accuracy for every wording, language, account state or conversation. Schema validation constrains model actions and output shape; it does not guarantee that every selected intent is correct. No model-generated values are accepted as saved account facts in the semantic record path.
