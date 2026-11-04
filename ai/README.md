# Phiq: private PhysiqueQuest assistant

Phiq uses a self-hosted, application-specific Ollama model called `physiquequest-phiq`, based on [Qwen3.5 4B](https://ollama.com/library/qwen3.5:4b). No AI-provider API key or cloud inference account is needed. The [upstream Qwen model](https://huggingface.co/Qwen/Qwen3.5-4B) is licensed under Apache-2.0; [Ollama](https://github.com/ollama/ollama) is MIT licensed. Preserve upstream notices if redistributing weights.

This is a customized open-weight model with request-time retrieval of curated system knowledge and permitted account records. It is not trained from scratch or fine-tuned on the database. Personal data never becomes part of the model weights. The model's general pretraining remains present; application scope is constrained by server-side retrieval, authorization, input/output validation, and instructions. Model instructions alone are not an authorization boundary.

## Local setup

Install [Ollama](https://ollama.com/download) and start its local service. From the repository root:

```powershell
rtk npm run ai:setup
rtk npm run ai:check
rtk npm run ai:warmup
```

Setup downloads about 4 GB of public model files, verifies local weights, and creates the model from `ai/Modelfile`. It is safe to rerun. Initial downloads require Internet access; inference uses the installed weights. `ai:check` checks model metadata only and does not query MongoDB or send a prompt. `ai:warmup` verifies local weights and loads them using an empty message list, with a separate 180-second startup budget. It does not access account data.

The backend defaults work with Ollama on the same computer:

```dotenv
CHAT_OLLAMA_URL=http://127.0.0.1:11434
CHAT_OLLAMA_MODEL=physiquequest-phiq
CHAT_TIMEOUT_MS=50000
```

Start the API and web application as described in the root README. Phiq is available from the signed-in application across Home, Coach, Scan, Quests, and Me. Personal records are optional and require the chat's explicit opt-in. Public system questions work without sharing account records. Messages stay in browser memory and are cleared by the chat controls/account changes; the chat endpoint does not save a conversation.

The reference development PC has an RTX 3050 with 6 GB VRAM and 32 GB RAM. The default runtime uses an 8192-token context, low temperature and at most 384 output tokens. Direct page help and supported exact account values do not wait for generation. Other replies use relevant retrieved context. Run `ai:warmup` before local chat traffic; production also prewarms asynchronously and maintains model residency, with a 30-minute keep-alive by default. The normal generation deadline remains 50 seconds. Cold starts, CPU fallback, database/network latency and concurrent load affect response time; no zero-delay guarantee is possible. Use `rtk proxy ollama ps` to inspect actual GPU placement. There is no external AI-provider fallback.

## Runtime privacy and deployment

Run the Ollama daemon with `OLLAMA_NO_CLOUD=1` to [disable cloud models and web search](https://docs.ollama.com/faq#how-do-i-disable-ollama-s-cloud-features). Setup sets this for its CLI children but does not modify a running daemon or global user settings. Configure it in the daemon/service environment and restart Ollama when applying it. On Windows, the Ollama app inherits user environment variables; follow the [official environment configuration instructions](https://docs.ollama.com/faq#setting-environment-variables-on-windows).

Keep Ollama bound to loopback for a same-host backend. Never expose port 11434 to the Internet or let browsers connect to it directly: its native local API is not the application's authenticated API. For container deployments, use an isolated private network and the `ollama` service hostname without publishing its port. A separate inference host must use a private network, firewall rules admitting only the backend, and encrypted transport when the network is not trusted. The backend accepts only a configured loopback origin, private IPv4 address, or `ollama` hostname and rejects cloud model metadata; user requests cannot choose an inference endpoint or model.

Inference happens on the machine hosting Ollama. A production backend hosted elsewhere cannot reach this PC through `127.0.0.1`: deploy a private runtime alongside that backend or use its approved private inference address. The [production package](deploy/README.md) supplies frontend/API/Coach/inference containers, persistent model storage, NVIDIA GPU configuration and a single HTTPS gateway. It does not provision or publish a GPU host. Additional private DNS endpoints require exact `CHAT_OLLAMA_ALLOWED_HOSTS` entries; every resolved address must be private and is pinned to the connection.

The model has no SQL/MongoDB, shell, browser, file, external-search, or mutation tools. The API supplies bounded, allowlisted data scoped to the authenticated user. It never retrieves other accounts, authentication/session records, raw photos, or secrets. With consent, explicitly requested health-profile or emergency-contact fields are fetched only from the signed-in user's profile, projected field by field, and handled deterministically without entering a model prompt. Keep runtime/request-body logging disabled for chat content and restrict operating-system access to the inference host; authorized machine administrators can inspect process memory. Configure reverse proxies and observability so they do not capture prompts or replies.

## Knowledge maintenance and checks

All 35 reviewed pages/subpages are catalogued in `backend/src/chat/chat-pages.ts`, with relevant module policies in `chat-knowledge.ts`. Route-coverage tests check the registry against actual frontend routes. Retrieval is in `chat-context.service.ts`; direct accurate answers are in `chat-fast-answers.ts`. Shared question interpretation handles diet/nutrition aliases, calorie targets, page-aware plans and follow-ups. No shared personal-data embedding index or training corpus is created. Keep missing records and incomplete snapshots explicit. Source metadata is validated internally and never rendered as a visible reply footer. The chat supports current-page hints, retry and actual client request cancellation.

Run the backend chat tests and frontend chat tests after any context, identity, scope, or model changes. Include two-user isolation, opt-out, malformed model output, prompt injection, unsupported topics, unavailable runtime, and account replacement. Language-model answers can still be mistaken; internal evidence validation does not prove factual accuracy. Exact record formatters, explicit missing-data responses and independent fact checks reduce common errors. Health guidance must remain limited to application records and safe application use, with no diagnosis or medication advice.

Run `rtk npm run ai:evaluate` from the root to build the backend and evaluate the real local model with synthetic fixtures. It does not load real account records or connect to MongoDB, and writes `ai/evaluation-latest.json`. The dedicated read-only Quest summary can explain your calculated XP, level, streak, missions and non-ranking badges without loading another user's data. Recent raw meal/workout/measurement details remain bounded. See [the access and security contract](AI-SPEC.md) for the complete data matrix.

For the larger natural-question regression suite, run `rtk npm run ai:evaluate:questions` from the root. It builds the backend, warms the local runtime, evaluates the production service against synthetic records three times, and writes `ai/question-evaluation-latest.json`. Use `-- --passes=1` through `-- --passes=5` to choose the repeat count. [The question matrix](question-test-matrix.md) describes the 229-case corpus, deterministic wording variants, 23 reasoning probes, browser tests and isolated-database checks. Exact daily and supported calendar-period nutrition totals use all owned matching saved entries in the account timezone; displayed meal details remain bounded. Remaining amounts, calendar-day/per-entry averages, independent settings targets, planned/completed durations and multi-turn fragments have factual regression checks.

Expanded consented context also includes saved body measurements, active workouts, selected preferences, notification titles/count/reminder time and safety delivery status metadata. Health conditions/notes and emergency-contact fields are available only for explicit own-account questions and never enter model prompts; credentials, locations, media and other users remain excluded. Shared MongoDB account/IP quotas work across API replicas. `GET /api/chat/status` requires authentication and returns only model readiness. See `backend/.env.example` for bounded tuning options.

Unreviewed phrasing now goes through a local semantic resolver. The resolver selects only IDs from `chat-semantic-router.ts`; it cannot write queries, choose an account, change records or generate saved values. Its input contains the user question, limited prior user questions, page context and literal field hints, with no database records. The server validates the selection, enforces consent and reloads the selected own-account records through existing formatters. Explicit dates, logged versus target nutrition, latest Progress measurements versus profile values and page-aware plans remain server-controlled. Reviewed literal requests, procedures and basic education retain direct paths. Ambiguous requests or resolver failures ask for clarification; clearly unrelated questions retain scope boundaries. This is meaning-based generalization, not a guarantee of perfect intent classification.

Run `rtk npm run ai:evaluate:paraphrases` for repeated real-model checks of unlisted phrasing. Add `-- --fresh` to generate 12 additional questions from synthetic intents before testing; the generated questions are written to `generated-paraphrases-latest.json` and are never added to routing rules or model weights. Inspect generated questions for changed meaning or units; generation is not an independent correctness oracle. Add `-- --replay-fresh` to retest the saved generated questions without generating another set. Results and selected route IDs are in `paraphrase-evaluation-latest.json`. To check each original corpus intent once through the new resolver, use `rtk npm run ai:evaluate:questions -- --passes=1 --original-only`; the default command still tests all wording wrappers. The question runner records semantic resolution separately from free answer generation. Use `-- --passes=1 --original-only --only=CASE_ID` for a focused native-model reproduction.

See [verification results](VERIFICATION.md) for the completed local checks and practical limits. The evaluation runners warm the runtime before exercising the chatbot.

Ollama API reference: [chat](https://docs.ollama.com/api/chat), [structured outputs](https://docs.ollama.com/capabilities/structured-outputs), [Modelfile](https://docs.ollama.com/modelfile).
