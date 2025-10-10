# Pre-Launch Review: Critical Issues & Recommendations

**Review Date:** 2025-10-10  
**Security Score:** 9.5/10 ✅  
**Production Readiness:** ⚠️ REQUIRES FIXES

---

## 🚨 CRITICAL ISSUES (Must Fix Before Launch)

### 1. **Push Notification System - Incomplete Implementation**
**Location:** `supabase/functions/send-push-notification/index.ts:45-51`

**Issue:** The `sendWebPush` function is a STUB - it logs but doesn't actually send notifications!

```typescript
// CURRENT CODE - DOES NOT SEND REAL NOTIFICATIONS
async function sendWebPush(...) {
  console.log('[send-web-push] Would send to:', subscription.endpoint);
  console.log('[send-web-push] DRYRUN mode: skipping actual send');
  return true; // ❌ FAKE SUCCESS!
}
```

**Impact:** 
- Users will never receive push notifications
- Logs will show success even though nothing was sent
- No error handling for actual delivery failures

**Fix Required:**
- Implement actual Web Push protocol (JWT + ECDH encryption)
- OR integrate OneSignal/Firebase Cloud Messaging (recommended)
- See `docs/PRODUCTION_PUSH_SETUP.md` for full implementation guide

**Priority:** 🔴 CRITICAL - Feature is advertised but non-functional

---

### 2. **Jobs Runner - Missing Encrypted Column Support**
**Location:** `supabase/functions/jobs-runner/index.ts:260, 328`

**Issue:** Jobs runner still references OLD plaintext columns that NO LONGER EXIST:

```typescript
// Line 260 - WILL CRASH!
const { data: subs } = await supabase
  .from('user_push_subs')
  .select('endpoint, p256dh, auth, user_id')  // ❌ auth, p256dh don't exist!
  .in('user_id', followerIds);

// Line 328 - WILL FAIL!
subscription: { 
  endpoint: sub.endpoint, 
  p256dh: sub.p256dh,  // ❌ undefined!
  auth: sub.auth        // ❌ undefined!
},
```

**Impact:**
- Background job to send push notifications will crash
- All queued notifications will fail silently
- Dead letter queue will fill up

**Fix Required:**
```typescript
// CORRECTED CODE
const { data: subs } = await supabase
  .from('user_push_subs')
  .select('endpoint, p256dh_enc_b64, auth_enc_b64, user_id')
  .in('user_id', followerIds);

// Later, decrypt before sending:
const auth = await open(fromBase64Text(sub.auth_enc_b64));
const p256dh = await open(fromBase64Text(sub.p256dh_enc_b64));
```

**Priority:** 🔴 CRITICAL - Will cause runtime errors

---

### 3. **Daily Digest - Placeholder Implementation**
**Location:** `supabase/functions/send-daily-digest/index.ts:113-137`

**Issue:** Digest logs notification but NEVER ACTUALLY SENDS IT:

```typescript
// Lines 113-134 - Build digest payload but...
const title = `Daily Digest: ${digest.length} update(s)`;
const body = digest.slice(0, 3).map(...).join(", ");

// Line 128-134 - ONLY LOGS, DOESN'T SEND!
await supabase.from("notification_log").insert({
  user_id: userPref.user_id,
  brand_id: "digest",
  category: "digest",
  delta: digest.length,
  success: true,  // ❌ Lie! Nothing was sent
});

// ❌ MISSING: Actual call to send-push-notification!
```

**Impact:**
- Digest mode appears to work but sends nothing
- Users think they're subscribed but receive no updates
- False reporting in notification logs

**Fix Required:**
```typescript
// Add actual push sending:
for (const pushSub of pushSubs) {
  await supabase.functions.invoke('send-push-notification', {
    body: {
      subscription: pushSub,
      brand_id: "digest",
      brand_name: title,
      category: "digest",
      delta: digest.length,
      payload: { title, body, /* ... */ }
    }
  });
}
```

**Priority:** 🔴 CRITICAL - Feature is completely non-functional

---

## ⚠️ HIGH PRIORITY ISSUES

### 4. **Score Calculation - Rough Delta Estimation**
**Location:** `supabase/functions/send-daily-digest/index.ts:106`

**Issue:** Delta calculation is hardcoded estimate, not actual score change:

```typescript
delta: -5 * catEvents.length, // ❌ Rough estimate
```

**Impact:**
- Inaccurate score change notifications
- Misleading user information
- Breaks trust in scoring system

**Recommendation:**
- Calculate actual delta from `brand_scores` table
- Compare current vs. 24h-ago scores
- Store historical snapshots for accurate tracking

**Priority:** 🟡 HIGH - Affects data accuracy

---

### 5. **GDELT API - No Rate Limiting or Error Handling**
**Location:** `supabase/functions/calculate-brand-score/index.ts:108-109`

**Issue:** External API call with minimal protection:

```typescript
const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=...`;
const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
```

**Problems:**
- No retry logic for failures
- 10-second timeout may be too aggressive
- No fallback if GDELT is down
- Could cause scoring job failures

**Recommendation:**
- Add exponential backoff retry (3 attempts)
- Increase timeout to 30s
- Gracefully degrade if API unavailable
- Cache results to reduce API calls

**Priority:** 🟡 HIGH - External dependency risk

---

### 6. **Brand Detail Page - Multiple Sequential Queries**
**Location:** `src/pages/BrandDetail.tsx:45-87`

**Issue:** Three separate sequential database queries on page load:

```typescript
// Query 1: Brand data
const { data: brandData } = await supabase
  .from('brands')
  .select(...).single();

// Query 2: Scores
const { data: scores } = await supabase
  .from('brand_scores')
  .select(...).maybeSingle();

// Query 3: Events
const { data: events } = await supabase
  .from('brand_events')
  .select(...);

// Query 4: Sources for all events
const { data: srcs } = await supabase
  .from('event_sources')
  .select(...).in('event_id', eventIds);
```

**Impact:**
- Slow page load (4 round-trips to database)
- Unnecessary network overhead
- Poor user experience on slow connections

**Recommendation:**
- Use single query with joins:
```typescript
const { data } = await supabase
  .from('brands')
  .select(`
    *,
    brand_scores(*),
    brand_events(
      *,
      event_sources(*)
    )
  `)
  .eq('id', brandId)
  .single();
```

**Priority:** 🟡 HIGH - Performance issue

---

## 🔵 MEDIUM PRIORITY ISSUES

### 7. **Check Subscription - Exposes Detailed Errors to Client**
**Location:** `supabase/functions/check-subscription/index.ts:87-94`

**Issue:** Leaks internal error messages:

```typescript
catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return new Response(JSON.stringify({ error: errorMessage }), {
    status: 500,  // ❌ Exposes details
  });
}
```

**Security Concern:**
- Could reveal database structure
- Exposes Stripe API errors
- Aids in reconnaissance attacks

**Recommendation:**
```typescript
catch (error) {
  console.error('[CHECK-SUBSCRIPTION] Internal error:', error);
  return new Response(JSON.stringify({ 
    error: "Unable to verify subscription" 
  }), { status: 500 });
}
```

**Priority:** 🔵 MEDIUM - Security hardening

---

### 8. **Score Staleness Check - Hardcoded 30-Day Threshold**
**Location:** `src/lib/scoring.ts:71-74`

**Issue:** Fixed threshold may not suit all brands:

```typescript
export function isScoreStale(lastUpdated?: string): boolean {
  const daysSince = (Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
  return daysSince > 30;  // ❌ Always 30 days
}
```

**Recommendation:**
- Make threshold configurable per brand
- Different thresholds for different categories
- Consider brand activity level

**Priority:** 🔵 MEDIUM - Scoring logic improvement

---

### 9. **Notification Rate Limiting - Inconsistent Implementation**
**Location:** `supabase/functions/jobs-runner/index.ts:313-322`

**Issue:** Rate limit function exists but logic is unclear:

```typescript
const { data: allowed } = await supabase.rpc('allow_push_send', {
  p_user_id: sub.user_id,
  p_brand: brand_id,
  p_category: 'batch'  // ❌ 'batch' is not a real category
});
```

**Problems:**
- "batch" category doesn't match real categories
- No clear documentation of rate limit rules
- Could allow spam if misconfigured

**Recommendation:**
- Document rate limiting rules clearly
- Add tests for edge cases
- Consider per-user global limits

**Priority:** 🔵 MEDIUM - Anti-spam measure

---

## 💚 LOW PRIORITY / ENHANCEMENTS

### 10. **Frontend Error Handling - Generic Toast Messages**
**Issue:** Most mutations use generic "Success" or "Error" toasts without specific feedback

**Recommendation:**
- Add specific success messages ("Added to watchlist", "Notification settings updated")
- Show actionable error messages ("Network error - please try again")
- Add loading states to prevent duplicate submissions

**Priority:** 💚 LOW - UX improvement

---

### 11. **Database Queries - Missing Indexes**
**Potential Performance Issue:**

Several queries may benefit from indexes:
- `brand_events(brand_id, event_date)` - Frequently filtered together
- `user_follows(user_id, brand_id)` - Used in joins
- `notification_log(user_id, brand_id, sent_day)` - Rate limiting queries

**Recommendation:**
- Run `EXPLAIN ANALYZE` on production queries
- Add composite indexes where needed
- Monitor slow query log

**Priority:** 💚 LOW - Performance optimization

---

### 12. **Code Quality - Inconsistent Error Logging**
**Issue:** Some functions use detailed logging, others don't

Examples:
- `check-subscription` has excellent step-by-step logging ✅
- `send-daily-digest` has minimal logging ❌
- `calculate-brand-score` mixes console.log and console.error

**Recommendation:**
- Standardize logging format across all edge functions
- Add request IDs for tracing
- Use structured logging (JSON format)

**Priority:** 💚 LOW - Maintainability

---

## 📋 PRE-LAUNCH CHECKLIST

### Must Complete Before Launch:
- [ ] **Implement real push notification sending** (Critical)
- [ ] **Fix jobs-runner encrypted column references** (Critical)
- [ ] **Implement daily digest sending** (Critical)
- [ ] **Add error retry logic for GDELT API** (High)
- [ ] **Optimize BrandDetail page queries** (High)
- [ ] **Sanitize all error messages to clients** (Medium)
- [ ] **Document rate limiting rules** (Medium)
- [ ] **Add production monitoring/alerting** (High)
- [ ] **Load test with expected traffic** (High)
- [ ] **Set up automated database backups** (Critical)

### Post-Launch Improvements:
- [ ] Replace hardcoded constants with config table
- [ ] Add admin dashboard for monitoring jobs queue
- [ ] Implement database query indexes
- [ ] Add structured logging
- [ ] Create automated tests for edge functions
- [ ] Set up error tracking (Sentry/Rollbar)

---

## 🎯 RECOMMENDED LAUNCH SEQUENCE

1. **Week 1: Fix Critical Issues**
   - Implement real push notifications OR disable feature
   - Fix jobs-runner column references
   - Fix daily digest sending

2. **Week 2: High Priority Issues**
   - Add GDELT retry logic
   - Optimize database queries
   - Fix delta calculations

3. **Week 3: Testing & Monitoring**
   - Load testing
   - End-to-end testing
   - Set up monitoring dashboards

4. **Week 4: Soft Launch**
   - Limited beta users
   - Monitor for issues
   - Fix bugs as they arise

5. **Week 5+: Public Launch**
   - Full rollout
   - Address medium/low priority issues
   - Continuous improvement

---

## 📊 CURRENT SYSTEM STATUS

| Component | Status | Production Ready? |
|-----------|--------|-------------------|
| Authentication | ✅ Working | Yes |
| Database & RLS | ✅ Excellent | Yes |
| Scoring System | ⚠️ Functional but improvable | Yes* |
| Push Notifications | ❌ Non-functional | **NO** |
| Daily Digest | ❌ Non-functional | **NO** |
| Stripe Payments | ✅ Working | Yes |
| Security | ✅ 9.5/10 | Yes |
| Performance | ⚠️ Needs optimization | Yes* |
| Error Handling | ⚠️ Inconsistent | Yes* |

**Legend:** 
- ✅ = Production ready
- ⚠️ = Works but needs improvement  
- ❌ = Not functional / Broken

---

## 💡 FINAL RECOMMENDATIONS

### Option A: Launch WITHOUT Push Notifications (SAFE)
1. Disable push notification UI completely
2. Remove digest mode option
3. Fix all database query issues
4. Launch in 1-2 weeks

### Option B: Implement Push Notifications Properly (RECOMMENDED)
1. Integrate OneSignal for push (3-5 days)
2. Fix jobs-runner and digest
3. Full testing of notification flow
4. Launch in 3-4 weeks

### Option C: Hybrid Approach
1. Launch with email notifications instead of push
2. Add push notifications in v1.1
3. Set user expectations clearly
4. Launch in 2 weeks

---

**Review Completed By:** AI Security & Code Review System  
**Next Review:** Before final production deployment  
**Contact:** See `docs/TROUBLESHOOTING.md` for support