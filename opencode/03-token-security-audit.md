# PoseTracker Token Security Audit & Provider Inquiry

**Date:** 2026-11-07  
**Classification:** CONFIDENTIAL — Contains security architecture details  
**Purpose:** Document token exposure risks and formal inquiry to provider

---

## Executive Summary

**Finding: CRITICAL** — The PoseTracker provider API token is exposed in the iframe URL returned by the authenticated launch endpoint. Any authenticated user can extract the token via browser DevTools and use it independently. This violates least-privilege principles and creates account takeover, quota theft, and compliance risks.

**Immediate Action Required:** Request short-lived, scoped iframe tokens from provider before any production deployment.

---

## Current Token Flow (Vulnerable)

```
┌─────────────┐     POST /launch      ┌─────────────┐
│  Frontend   │ ─────────────────────▶ │  Backend    │
│  (React)    │ ◀───────────────────── │  (NestJS)   │
└─────────────┘   { iframeUrl,        └─────────────┘
                   token,                │
                   exerciseName }        │ Reads POSETRACKER_API_TOKEN
                                         │ from process.env
                   ┌─────────────┐       │
                   │  Frontend   │       │
                   │  sets       │       │
                   │  iframe.src │       │
                   │  = iframeUrl│       │
                   └──────┬──────┘       │
                          │              │
                          ▼              │
                   ┌─────────────┐       │
                   │  Browser    │       │
                   │  DevTools   │       │
                   │  Network tab│       │
                   │  → TOKEN    │       │
                   └─────────────┘       │
```

### Token Exposure Points

| Location | Accessible By | Persistence |
|----------|---------------|-------------|
| `POST /api/pose-tracker/exercises/:id/launch` response body | Authenticated user (DevTools Network) | Session |
| `iframe.src` URL (query param `token=...`) | Authenticated user (Elements tab, console) | Session + History |
| `Referer` header on iframe resource loads | Third-party domains loaded by provider | Request |
| Browser history | Authenticated user | Until cleared |
| Backend logs (if misconfigured) | Anyone with log access | Retention period |

### Attack Scenarios

| Scenario | Impact | Likelihood |
|----------|--------|------------|
| **User extracts token, builds own app** | Quota exhaustion, unauthorized usage, brand risk | High |
| **XSS in PhysiqueQuest steals token** | Full account compromise | Medium (if XSS exists) |
| **Shared computer, user forgets to clear history** | Next user accesses token | Low-Medium |
| **Referer leakage to analytics/tracking scripts** | Token in third-party logs | Medium |
| **Malicious browser extension** | Automated token harvesting | Low |

---

## Threat Model (STRIDE)

| Threat | Applicability | Current Mitigation | Gap |
|--------|---------------|-------------------|-----|
| **Spoofing** | Attacker uses token to impersonate PhysiqueQuest | None (token = identity) | 🔴 Critical |
| **Tampering** | Attacker modifies token params (exercise, mode) | None | 🔴 Critical |
| **Repudiation** | Provider cannot distinguish PhysiqueQuest vs. attacker calls | None | 🔴 Critical |
| **Information Disclosure** | Token visible in DevTools, history, Referer | `private, no-store` headers only | 🔴 Critical |
| **Denial of Service** | Attacker burns quota via automated calls | None | 🟡 High |
| **Elevation of Privilege** | Token may have admin scopes (unknown) | Unknown | 🟡 High |

---

## Provider Token Architecture Questions

### Required: Short-Lived Iframe Tokens

**We need the provider to support:**
```
POST /api/v1/iframe-tokens
Authorization: Bearer <PHYSIQUEQUEST_API_TOKEN>
Content-Type: application/json

{
  "exercise_id": "squat",
  "mode": "builtin",
  "reference_uuid": null,
  "ttl_seconds": 300,           // 5 minutes
  "allowed_origins": ["https://app.physiquequest.com"],
  "max_sessions": 1,
  "scopes": ["tracking:read", "tracking:write"]
}
```

**Response:**
```json
{
  "iframe_token": "eyJhbGciOiJIUzI1NiIs...",  // JWT
  "expires_at": "2026-11-07T14:35:00Z",
  "iframe_url": "https://tracker.poseprovider.com/embed?token=eyJhbGciOiJIUzI1NiIs..."
}
```

### Required: Token Scoping

| Scope | Description | PhysiqueQuest Needs |
|-------|-------------|---------------------|
| `tracking:read` | Receive events (counter, form_score, etc.) | ✅ Yes |
| `tracking:write` | Send control messages (start, stop, set_exercise) | ✅ Yes |
| `reference:read` | List/reference custom movements | Admin only |
| `reference:write` | Create references | Admin only (provider dashboard) |
| `account:read` | Quota, usage, billing | Backend only |

### Required: Usage Monitoring API

```
GET /api/v1/usage?since=2026-11-01&until=2026-11-07
Authorization: Bearer <PHYSIQUEQUEST_API_TOKEN>
```

**Response:**
```json
{
  "total_calls": 1247,
  "unique_sessions": 892,
  "quota_limit": 10000,
  "quota_remaining": 8753,
  "by_exercise": { "squat": 340, "push_up": 298, ... },
  "by_outcome": { "completed": 801, "timeout": 45, "error": 46 },
  "anomalous_ips": []
}
```

---

## Formal Provider Inquiry (Ready to Send)

> **TO:** PoseTracker Provider Support / Partnerships
> **FROM:** PhysiqueQuest Engineering
> **DATE:** 2026-11-07
> **SUBJECT:** Technical Integration Requirements — Short-Lived Iframe Tokens & Commercial Terms
>
> ---
>
> We are integrating PoseTracker into PhysiqueQuest, a commercial fitness application with ~50k MAU (projected). Our current architecture uses your iframe embed with the API token passed directly in the iframe URL query parameter.
>
> **Security Concern:** This exposes our account token to any authenticated end-user via browser DevTools, creating risks of quota theft, unauthorized usage, and inability to audit access. We require a short-lived, scoped token mechanism for iframe embedding.
>
> **Technical Requirements:**
>
> 1. **Short-Lived Iframe Token Endpoint**
>    - Accepts our server-side API token + exercise config + TTL (5-10 min)
>    - Returns signed JWT token + iframe URL with that token
>    - Token scoped to: single session, specific exercise, allowed origins
>    - Supports both built-in exercise IDs and custom reference UUIDs
>
> 2. **Token Scopes**
>    - `tracking:read` / `tracking:write` for session events
>    - Separate scopes for reference management (admin only)
>    - Account-scoped tokens never sent to client
>
> 3. **Usage Monitoring API**
>    - Real-time quota consumption
>    - Per-exercise, per-outcome breakdown
>    - Anomaly detection (unusual IP, burst usage)
>
> 4. **Commercial Terms Clarification**
>    - Current free tier reportedly prohibits commercial use
>    - Need published pricing for:
>      - Per-session or per-minute pricing
>      - Monthly quota tiers (10k / 100k / 1M sessions)
>      - Enterprise SLA (uptime, support, data residency)
>    - Data processing agreement (GDPR/CCPA) for pose data
>    - Confirmation: inference is on-device; what metadata reaches your servers?
>
> 5. **Technical Clarifications**
>    - Does `set_exercise` exist for chaining exercises without reload?
>    - What is the exact iframe `postMessage` event schema? (We have reverse-engineered; need authoritative spec)
>    - Supported browsers / WebView versions (iOS WKWebView, Android Chrome Custom Tab)
>    - Rate limits per token / per IP
>    - Webhook for session completion (async summary)
>
> **Timeline:** We target production validation in 4 weeks. Need technical responses within 1 week to unblock.
>
> **Contact:** [Engineering Lead], [Email], [Slack Connect if available]
>
> ---

---

## Mitigation Strategies (If Provider Cannot Deliver)

### Option A: Token Proxy Endpoint (Backend-for-Frontend)
```
Frontend → POST /api/pose-tracker/proxy/token → Backend
                    │                              │
                    │  Generates short-lived       │
                    │  HMAC-signed token           │
                    │  Stores in Redis (TTL 5min)  │
                    ▼                              ▼
              Returns { proxyToken }         Validates on
                                              iframe message
                                              receipt
```
- **Pros:** No provider changes needed
- **Cons:** Token still visible in proxy response; iframe still needs real provider token
- **Verdict:** Does not solve core issue — provider must accept proxy token

### Option B: Backend Iframe Proxy (Heavy)
```
Frontend → iframe.src = /api/pose-tracker/proxy/iframe?session=xyz
                    │
                    ▼
              Backend fetches provider iframe HTML
              Injects CSP, strips token from URL
              Serves proxied iframe
```
- **Pros:** Token never reaches browser
- **Cons:** Breaks provider CSP, camera permissions, cookie auth; maintenance nightmare
- **Verdict:** Not recommended

### Option C: Native-Only (Deprecate Web)
- Use only `PoseTrackerNative.tsx` path
- Token stays in native app binary / secure storage
- **Pros:** Solves token exposure
- **Cons:** Excludes web users (~60% of base); native unverified
- **Verdict:** Last resort

### Option D: Accept Risk (Not Recommended)
- Document risk, monitor usage, rotate token weekly
- **Pros:** Ship now
- **Cons:** Security incident inevitable; compliance failure
- **Verdict:** Unacceptable for commercial product

---

## Recommended Path Forward

| Step | Action | Owner | Deadline |
|------|--------|-------|----------|
| 1 | Send formal inquiry (above) to provider | Eng Lead | Today |
| 2 | Implement token proxy endpoint (Option A) as fallback | Backend Dev | 3 days |
| 3 | Add token rotation script (weekly, automated) | DevOps | 5 days |
| 4 | Add usage monitoring dashboard (poll provider API) | Backend Dev | 1 week |
| 5 | CSP headers: `frame-src https://tracker.poseprovider.com` | DevOps | 2 days |
| 6 | Audit backend logs for token leakage | Security | 1 week |
| 7 | Legal review of provider DPA / commercial terms | Legal | 2 weeks |

---

## Compliance Checklist

| Regulation | Requirement | Status |
|------------|-------------|--------|
| **GDPR Art. 28** | Data Processing Agreement with provider | ❌ Needed |
| **GDPR Art. 32** | Token as personal data? (access credential) | 🟡 Review |
| **CCPA** | "Sale" of data if token leaks? | 🟡 Review |
| **SOC 2** | Credential management controls | ❌ Gap |
| **ISO 27001** | A.9.2.3 Management of privileged access | ❌ Gap |

---

## Token Rotation Procedure (Interim)

```bash
#!/bin/bash
# rotate-pose-tracker-token.sh — Run weekly via cron

set -euo pipefail

# 1. Generate new token in provider dashboard (manual or API)
# 2. Update staging env
vercel env add POSETRACKER_API_TOKEN staging < new_token.txt

# 3. Update production env (with 5-min overlap)
vercel env add POSETRACKER_API_TOKEN production < new_token.txt

# 4. Verify launch endpoint works
curl -X POST https://staging.physiquequest.com/api/pose-tracker/exercises/squat/launch \
  -H "Authorization: Bearer $STAGING_ADMIN_TOKEN" \
  | jq -r '.iframeUrl' | xargs curl -sI | head -1

# 5. Monitor provider dashboard for 1hr for errors
# 6. Revoke old token in provider dashboard

echo "Rotation complete at $(date)"
```

---

## Security Testing Checklist (Pre-Production)

| Test | Method | Pass Criteria |
|------|--------|---------------|
| Token not in backend logs | `grep -r POSETRACKER_API_TOKEN /var/log/` | Zero matches |
| Token not in frontend bundle | `grep -r POSETRACKER_API_TOKEN .next/` | Zero matches |
| CSP `frame-src` restrictive | `curl -I https://app.physiquequest.com` | Header present |
| Referer policy | `<meta name="referrer" content="strict-origin-when-cross-origin">` | Present |
| Token rotation works | Run script, verify new token works | Launch succeeds |
| Quota monitoring alerts | Simulate burst usage | Alert fires |
| XSS cannot exfiltrate token | CSP `script-src 'self'` + nonce | Token not in `window` |

---

## Decision Log

| Date | Decision | Rationale | Revisit |
|------|----------|-----------|---------|
| 2026-11-07 | Block production deploy until short-lived tokens | Critical exposure | Provider response |
| 2026-11-07 | Implement weekly rotation as interim | Reduce blast radius | Short-lived tokens available |
| 2026-11-07 | Require DPA before commercial launch | GDPR compliance | Legal review complete |

---

*End of Token Security Audit. See `04-native-web-parity.md` for native vs. web event model comparison.*