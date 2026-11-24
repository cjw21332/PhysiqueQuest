# Security Parameters Research for PhysiqueQuest

**Date:** 2026-11-07  
**Status:** Research Phase - Findings Before Implementation  

---

## Executive Summary

This research identifies critical security parameters that should be implemented to hardening PhysiqueQuest's PoseTracker integration and overall system security. The findings are based on:

1. **Codebase analysis** of the existing PoseTracker integration
2. **Threat model** derived from the token exposure vulnerability
3. **Industry best practices** for fitness/health applications
4. **OWASP API Security Top 10** considerations

---

## 1. Current Security Posture Analysis

### 1.1 Token Exposure Vulnerability (CRITICAL)

| Issue | Current State | Risk |
|-------|--------------|------|
| **Iframe token in URL** | `POSETRACKER_API_TOKEN` passed in iframe URL query param | 🔴 Any authenticated user can extract token via DevTools |
| **Token lifetime** | 24h claimed, not enforced | 🔴 Potential quota exhaustion |
| **Token scope** | Full account access (assumed) | 🔴 Unlimited access if compromised |
| **Token rotation** | Not implemented | 🔴 Manual rotation required |
| **Token logging** | Possible in backend logs | 🔴 Log leakage risk |

**Root Cause:** The `trackingUrl()` function in `bridge.ts` embeds the token directly in the iframe URL:
```typescript
url.searchParams.set('token', token.trim());
```

### 1.2 Authentication & Authorization

| Control | Status | Gap |
|---------|--------|-----|
| JWT authentication | ✅ Present (`JwtAuthGuard`) | ✅ |
| Role-based access | ✅ Present (`RolesGuard`, `admin` role) | ✅ |
| Input validation | ✅ Present (Zod schema) | ✅ |
| Rate limiting | ❌ Not implemented | 🔴 Brute force / quota exhaustion |
| CSRF protection | ⚠️ Partial | 🟡 Same-site cookies only |
| Token scope validation | ❌ Not implemented | 🔴 Generated-angle mode bypasses |

### 1.3 Data Privacy

| Data Type | Stored? | Encryption | Gap |
|-----------|---------|------------|-----|
| Camera frames | ❌ Not stored | N/A | ✅ |
| Keypoint histories | ❌ Not stored (per design) | N/A | ✅ |
| Rep counts | ✅ Stored in MongoDB | Not encrypted | 🟡 |
| User profiles | ✅ Stored | Not encrypted | 🟡 |
| Pose tracking configs | ✅ Stored (`exerciseposetrackerconfigs`) | Not encrypted | 🟡 |

---

## 2. Recommended Security Parameters

### 2.1 Token Security (Immediate Action Required)

| Parameter | Recommendation | Effort | Priority |
|-----------|---------------|--------|----------|
| **Short-lived iframe tokens** | Request provider to support JWT iframe tokens with 5-10 min TTL | Provider-dependent | 🔴 Critical |
| **Token proxy endpoint** | Implement `/api/pose-tracker/proxy/token` that mint short-lived tokens from long-lived master token | Backend (1 day) | 🟡 High |
| **Token rotation script** | Weekly automated rotation via cron job | Backend (30 min) | 🟡 Medium |
| **Token scope restriction** | Limit token to: single exercise, single session, specific origin | Backend (2 days) | 🟡 High |
| **Token monitoring dashboard** | Real-time quota consumption visualization | Backend (2-3 days) | 🟡 Medium |

### 2.2 Input Validation & Rate Limiting

| Parameter | Recommendation | Effort | Priority |
|-----------|---------------|--------|----------|
| **Request rate limiting** | `50 requests/minute per IP`, `100 requests/hour per user` | Backend (1 day) | 🟠 High |
| **Payload size limits** | Max 64KB per launch request, max 10 IDs per config batch | Backend (0.5 day) | 🟢 Medium |
| **UUID validation** | Strict UUID v4 format validation for reference UUIDs | Already partially present | 🟢 Medium |
| **Exercise ID validation** | Regex: `^[a-zA-Z0-9_-]{1,80}$` | Already present | 🟢 Medium |
| **Origin restriction** | `origin` header check on all pose tracker endpoints | Backend (1 day) | 🟠 High |

### 2.3 CSP & Browser Security

| Parameter | Recommendation | Effort | Priority |
|-----------|---------------|--------|----------|
| **CSP header** | `Content-Security-Policy: default-src 'self'; frame-src https://app.posetracker.com;` | Frontend (0.5 day) | 🟢 Medium |
| **Referrer-Policy** | `<meta name="referrer" content="strict-origin-when-cross-origin">` | Frontend (0.5 day) | 🟢 Medium |
| **Permissions-Policy** | `camera=(), microphone=()` (except within iframe) | Frontend (0.5 day) | 🟢 Medium |
| **SRI (Subresource Integrity)** | For any external JS/CSS imports | Frontend (0.5 day) | 🟢 Low |

### 2.4 Privacy & Data Handling

| Parameter | Recommendation | Effort | Priority |
|-----------|---------------|--------|----------|
| **Data minimization** | Never store camera frames, raw keypoint histories, or video | ✅ Already designed | 🟢 Complete |
| **Purpose limitation** | Config stored only for tracking mode exercises, not persisted indefinitely | Backend (0.5 day) | 🟢 Medium |
| **Data retention** | Auto-expire configs not used within 90 days | Backend (1 day) | 🟡 Medium |
| **User consent** | Explicit consent prompt before first PoseTracker session | Frontend (1 day) | 🟡 Medium |
| **Data export/delete** | Allow users to request their pose tracking data deletion | Backend + Frontend (2 days) | 🟡 Medium |

### 2.5 Error Handling & Logging

| Parameter | Recommendation | Effort | Priority |
|-----------|---------------|--------|----------|
| **Error sanitization** | Never return stack traces or internal details to user | Frontend (0.5 day) | 🟢 Medium |
| **Structured logging** | JSON logs with request ID, no sensitive data | Backend (1 day) | 🟡 Medium |
| **Error rate monitoring** | Alert on >5% error rate for pose tracker endpoints | Backend (2 days) | 🟡 Medium |
| **Failed login tracking** | Track and lock after 5 failed attempts | Backend (0.5 day) | 🟢 Medium |

---

## 3. Implementation Priority Matrix

| Priority | Parameter | Effort | Impact | Start Date |
|----------|-----------|--------|--------|------------|
| 🔴 **P0** | Token scope restriction + rate limiting | 2-3 days | Prevents quota exhaustion & token misuse | Today |
| 🟠 **P1** | Token proxy endpoint (short-lived tokens) | 2-3 days | Reduces token exposure risk | Today |
| 🟠 **P1** | CSP header + referrer policy | 1 day | Reduces XSS/clickjacking risk | Tomorrow |
| 🟡 **P2** | Input validation hardening | 1 day | Prevents injection attacks | This week |
| 🟡 **P2** | Data retention auto-expire | 1 day | Reduces stored sensitive data | This week |
| 🟢 **P3** | User consent prompts | 1 day | Privacy compliance | This week |
| 🟢 **P3** | Error sanitization | 0.5 day | Security best practice | This week |
| 🟢 **P3** | SRI for external assets | 0.5 day | Supply chain protection | This week |

---

## 4. Implementation Roadmap

### Phase 1: Critical (This Week)
- [ ] Implement token scope restriction in `validateOverride()`
- [ ] Add rate limiting middleware to PoseTracker endpoints
- [ ] Add CSP header and referrer policy
- [ ] Add input validation hardening

### Phase 2: High (Next Week)
- [ ] Implement token proxy endpoint for short-lived tokens
- [ ] Add data retention auto-expire (90 days)
- [ ] Add user consent prompt for PoseTracker sessions
- [ ] Add error sanitization

### Phase 3: Medium (2-3 Weeks)
- [ ] Implement token rotation script
- [ ] Add data export/delete functionality
- [ ] Add structured logging
- [ ] Add error rate monitoring

### Phase 4: Optional (2-4 Weeks)
- [ ] SRI for external assets
- [ ] Advanced privacy features
- [ ] Penetration testing

---

## 5. Code Changes Required

### 5.1 Backend (`pose-tracker.module.ts`)

```typescript
// Add to Zod input schema
const input = z.object({
  trackingMode: z.enum(['builtin','reference','generated-angle','unavailable']),
  providerExerciseId: z.string().max(80).optional(),
  referenceUuid: z.string().uuid().optional(),
  generatedAngleConfig: generatedAngleConfigSchema.optional(),
  cameraOrientation: z.enum(['front','side','reference','pending']),
  validationStatus: z.enum(['pending','verified','disabled']),
  limitations: z.array(z.string().max(500)).max(20),
  verificationNotes: z.string().max(2000).optional(),
  // NEW: Rate limiting
  requestId: z.string().uuid(),
}).strict().refine(data => {
  // NEW: Mutual exclusivity
  if (data.trackingMode === 'builtin') return !data.referenceUuid && !data.generatedAngleConfig;
  if (data.trackingMode === 'reference') return !data.providerExerciseId && !data.generatedAngleConfig;
  if (data.trackingMode === 'generated-angle') return !!data.generatedAngleConfig && !data.providerExerciseId && !data.referenceUuid;
  if (data.trackingMode === 'unavailable') return !data.providerExerciseId && !data.referenceUuid && !data.generatedAngleConfig;
  return true;
}, { message: 'Mutually exclusive tracking identifiers' });

// NEW: Rate limiting helper
const rateLimitMiddleware = (limit: number, windowMs: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Implement sliding window rate limit
    // ...
  };
};

// NEW: Token scope validation
const validateTokenScope = (token: string, mode: string) => {
  // Validate token has appropriate scopes for mode
  // ...
};
```

### 5.2 Frontend (`poseTracker/bridge.ts`)

```typescript
// NEW: Add origin check
export function trustedProviderEvent(event: Pick<MessageEvent,'origin'|'source'|'data'>, source: Window | null) {
  // NEW: Check origin matches expected provider origin
  const expectedOrigin = 'https://app.posetracker.com';
  return source && event.source === event.currentWindow && event.origin === expectedOrigin 
    ? normalizeProviderEvent(event.data) : null;
}

// NEW: Add origin to tracking URL restrictions
export function trackingUrl(config: TrackingConfig, token: string, ...) {
  // NEW: Reject if no token or empty token
  if (!token.trim()) throw Error('PoseTracker token is missing');
  // NEW: Add origin check
  // ...
}
```

### 5.3 Frontend (`PoseTrackerSession.tsx`)

```typescript
// NEW: Add consent prompt before first session
const [hasConsented, setHasConsented] = useState(false);

useEffect(() => {
  // Check if user has consented to pose tracking
  const consented = localStorage.getItem('poseTrackerConsent');
  if (!consented) {
    // Show consent modal
    // ...
  }
}, []);

// NEW: Add to UI
{hasConsented || <p>Allow pose tracking to count repetitions and provide form feedback.</p>}
```

---

## 6. Threat Model Summary

| Threat | Likelihood | Impact | Mitigation |
|--------|------------|--------|------------|
| **Token exposure via DevTools** | High | High | Token scope restriction + proxy endpoint |
| **Brute force launch requests** | Medium | Medium | Rate limiting |
| **XSS stealing token** | Medium | High | CSP header, input sanitization |
| **Data leakage via logs** | Medium | Medium | Error sanitization, no sensitive data in logs |
| **Unauthorized config changes** | Medium | Medium | Admin role + validation |
| **Cross-origin request forgery** | Low | Medium | CSRF tokens, same-site cookies |
| **Data retention beyond need** | Low | Medium | Auto-expire configs |

---

## 7. Next Steps

1. **Immediate (Today):** Implement P0 items (token scope, rate limiting)
2. **Short-term (This Week):** Implement P1 items (token proxy, CSP)
3. **This Week:** Implement P2 items (input validation, data retention)
4. **Optional:** Implement P3 items (consent, SRI, error sanitization)

---

*Research complete. Findings ready for implementation planning.*