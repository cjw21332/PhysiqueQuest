<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Food scanning

`POST /api/nutrition/scan` runs a photo of a meal through a vision model to
identify the food, then prices each identified item against USDA FoodData
Central. All three scanner routes require a valid JWT, like the rest of the API.

| Route | Purpose |
| --- | --- |
| `POST /api/nutrition/scan` | Analyse a base64 image. Returns one entry per detected item with macros scaled to the estimated weight, plus `totals` and `unmatched`. |
| `GET /api/nutrition/foods/search?q=` | Search USDA for a single food by name. |
| `GET /api/nutrition/foods/:fdcId` | Fetch per-100 g macros for one USDA record. |
| `POST /api/nutrition/meals/from-scan` | Save a scan result. Writes one meal row per item that matched a nutrition record. |

The request and response bodies use `snake_case` and the `items` array from a
scan can be posted straight back to `meals/from-scan` without remapping:

```bash
curl -X POST /api/nutrition/scan -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"image":"<base64 png or jpeg>"}'

curl -X POST /api/nutrition/meals/from-scan -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"meal":"Lunch","items":[ ... ]}'
```

Items with `"found": false` matched no USDA record and are skipped rather than
saved as zero-calorie meals. A request where nothing matched is rejected.

Scanner errors use a structured envelope rather than Nest's default body:

```json
{ "error": { "code": "UPSTREAM_TIMEOUT", "message": "…", "request_id": "…" } }
```

Codes: `INVALID_REQUEST` (400), `UNAUTHENTICATED` (401), `NOT_FOUND` (404),
`PAYLOAD_TOO_LARGE` (413), `UNSUPPORTED_MEDIA_TYPE` (415), `RATE_LIMITED` (429),
`INTERNAL` (500), `UPSTREAM_UNAVAILABLE` (502), `SERVICE_UNAVAILABLE` (503),
`UPSTREAM_TIMEOUT` (504). Every response echoes an `x-request-id` header; send
your own to correlate the call with these logs.

The Gemini and USDA keys are both optional. Without them the process still
boots and every other route keeps working; the scanner answers 503. See
`.env.example` for the full list of variables.

USDA requests are retried once after transient 500, 502, 503, or 504 responses.
Food search loads nutrition details only after a result is selected, to avoid
unnecessary provider requests while the user is typing.

Two of those variables are worth knowing about when a scan is slow or fails:

- `GEMINI_THINKING_LEVEL` (default `LOW`) caps how much the model deliberates.
  Under a structured-output schema the unset level took about 9s per scan and
  overran `FOODSCAN_UPSTREAM_TIMEOUT_MS`, which surfaced as a 504 on a request
  that would otherwise have succeeded. `LOW` answers in roughly 4s.
- `GEMINI_ATTEMPTS` (default `3`) bounds retries. The provider intermittently
  answers 503 while a model is under load, and only that case is retried; an
  exhausted quota or a timeout is reported immediately rather than spending more
  of the caller's budget.

`FOODSCAN_REQUEST_TIMEOUT_MS` (default 25s) bounds a whole scan and is
deliberately far below the 60s the mobile client waits before offering a retry.
Keep it that way: a longer server deadline means the user abandons a request the
server is still working on, so the vision provider is still charged for a result
nobody sees, and an immediate retry starts a second scan alongside the first.
Raising the client cap instead means raising this too. `FOODSCAN_UPSTREAM_TIMEOUT_MS`
(default 20s) caps any single vision call, so a slow provider is reported as a
timeout rather than holding the request open until the deadline.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observer](https://observer.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

## Admin access

New accounts receive the `user` role. Admin routes require the role stored on the authenticated MongoDB user record; a client cannot grant itself access by changing a request or token. Provision only a trusted account using a database administrator connection:

```javascript
db.users.updateOne(
  { email: "trusted-admin@example.com" },
  { $set: { role: "admin" } }
)
```

The user must sign in again before the app shows the admin tools. To revoke access, set `role` back to `user`.

## Password reset email

Password reset codes are cryptographically random, one-time, expire after 30 minutes, and are stored only as hashes. To send them through EmailJS, set `SERVICE_ID`, `TEMPLATE_ID`, and `PUBLIC_KEY` in `backend/.env`; the `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`, and `EMAILJS_PUBLIC_KEY` names are also accepted. `EMAILJS_PRIVATE_KEY` is optional. The EmailJS template must use `{{email}}`, `{{passcode}}`, and `{{time}}` parameters. During development, `GET /api/auth/password-reset/status` reports which settings are present without returning their values; delivery errors include provider details outside production. If EmailJS is not configured, the existing delivery endpoint remains available by setting both `EMAIL_DELIVERY_URL` and `EMAIL_DELIVERY_API_KEY`; it receives `{ template: "password-reset", to, token, expiresInMinutes }` and must return a successful response only after accepting delivery. EmailJS credentials, delivery endpoint credentials, and reset codes must never be put in frontend or Expo environment variables.

Emergency alert delivery and pose analysis also stay unavailable until their corresponding `ALERT_DELIVERY_URL`/`ALERT_DELIVERY_API_KEY` or `POSE_ANALYSIS_URL`/`POSE_ANALYSIS_API_KEY` pair is configured. Alert delivery must return HTTP success only after accepting the idempotency key. Pose analysis accepts base64 video/image metadata on the backend and expects `{ "analysis": { ... } }` in the provider response. Credentials are read only by the backend.

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
