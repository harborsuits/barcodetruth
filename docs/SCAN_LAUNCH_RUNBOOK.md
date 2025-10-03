# Barcode Scanner Launch Runbook

## Pre-Launch Checklist (15-20 min)

### Device Testing

#### iPhone (Safari)
- [ ] Rear camera opens inline (no fullscreen takeover)
- [ ] Scans UPC-A and EAN-13 successfully
- [ ] Haptic feedback fires on detection
- [ ] HTTPS guardrail hidden on secure origins
- [ ] Torch button hidden (expected - iOS rarely exposes capability)
- [ ] Manual input works as fallback

#### Android (Chrome)
- [ ] Environment (back) camera selected automatically
- [ ] Torch button appears and toggles LED
- [ ] Haptic feedback works
- [ ] Scans common retail barcodes (EAN-13, UPC-A, Code 128)
- [ ] Manual input works

#### Desktop (Chrome/Edge)
- [ ] Webcam/USB camera access works
- [ ] Manual barcode input functions
- [ ] No torch button (expected)
- [ ] Route changes release camera

### Flow Testing

#### Happy Path
1. Navigate to `/scan`
2. Click "Start Camera" → camera opens, scanning reticle visible
3. Point at barcode → automatic detection
4. `scan_detect` logged to console
5. "Looking up product..." state shown
6. Success → haptic fires, brand page prefetches
7. Auto-navigate to `/brands/:id` after 1s
8. Check console: `resolve_ok`, `brand_nav` events logged

#### Not Found Path
1. Scan unknown barcode (or enter `00000000000001`)
2. Toast: "Product not found"
3. Dialog: "We couldn't match this product yet"
4. Click "Scan Again" → camera restarts
5. Verify cooldown: re-scan same code within 60s → cached response (no API call)

#### Manual Input
1. Scroll to "No camera? Enter barcode"
2. Type 12-13 digits (e.g., `012345678905`)
3. Press Enter or click "Lookup"
4. Invalid input (< 8 digits or non-numeric) → toast "Invalid barcode"
5. Valid input → same resolve flow as camera scan

#### Interrupted Flows
- [ ] Tab hidden (switch tabs) → camera stops, `visibilitychange` listener fires
- [ ] Return to tab → scanner idle, user must restart
- [ ] Route away from `/scan` → camera LED off within ~1s
- [ ] Lock screen/home button → no stuck camera stream

### Security & Headers

#### Required HTTP Headers (set at edge/proxy)
```http
Permissions-Policy: camera=(self)
Content-Security-Policy: default-src 'self'; connect-src 'self' https://midmvcwtywnexzdwbekp.supabase.co https://world.openfoodfacts.org; media-src blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'
Cross-Origin-Opener-Policy: same-origin
```

**Why:**
- `Permissions-Policy` restricts camera to same origin
- `media-src blob:` allows MediaStream video display
- `COOP: same-origin` keeps performance stable for camera operations

#### HTTPS Guardrail
- [ ] On non-HTTPS (not localhost) → warning card displayed
- [ ] "Start Camera" button disabled
- [ ] Clear message: "Camera requires HTTPS"

### PWA Configuration

#### Manifest (`public/manifest.webmanifest`)
- [x] `prefer_related_applications: false` set
- [x] Icons configured (192x192, 512x512)
- [x] `display: "standalone"` for app-like experience

#### Service Worker (`public/service-worker.js`)
- [x] `/scan` page excluded from aggressive caching
- [x] Reason: camera/MediaStream must always be fresh
- [x] Static assets still cached for offline support

### Accessibility

- [ ] `aria-live="polite"` announces status changes ("Scanning", "Looking up", "Found", "Not found")
- [ ] Torch button has `aria-pressed` attribute
- [ ] "Start Camera" has `aria-label="Start barcode scanner"`
- [ ] Manual input usable via keyboard only (Tab, Enter)
- [ ] Focus visible on all interactive elements

---

## Observability & Monitoring

### Edge Function Logs

**Saved Queries to Create:**

1. **Error Rate Alert**
   ```
   fn="resolve-barcode" AND level="error"
   ```
   Alert if > 5 errors in 5 minutes

2. **Miss Rate Tracking**
   ```
   fn="resolve-barcode" AND ok=false AND source="none"
   ```
   Track barcode not found rate

3. **P95 Latency**
   ```
   fn="resolve-barcode" AND dur_ms > 800
   ```
   Alert if P95 latency exceeds 800ms for 5 minutes

4. **Rate Limit Abuse**
   ```
   fn="resolve-barcode" AND level="warn" AND msg="rate_limited"
   ```
   Track per-IP rate limiting hits

### Frontend Analytics

**Console Events (structured logging):**
- `[Analytics] scan_start` - User clicked "Start Camera"
- `[Analytics] scan_detect { barcode, ts }` - Barcode detected
- `[Analytics] resolve_ok { barcode, brand_id, dur_ms }` - Lookup succeeded
- `[Analytics] resolve_miss { barcode, dur_ms }` - Not found in DB
- `[Analytics] brand_nav { brand_id }` - User navigated to brand page

**Metrics to Track:**
- Time from `scan_start` to `scan_detect` (scan latency)
- Time from `scan_detect` to `resolve_ok` (API latency)
- Miss rate (resolve_miss / total scans)
- Manual input usage rate

---

## Troubleshooting Guide

### Camera Won't Start

**Symptoms:** "Start Camera" clicked, no video appears

**Causes & Fixes:**

1. **Not HTTPS**
   - Check: `window.location.protocol` should be `https:` (or `localhost`)
   - Fix: Deploy to HTTPS or test on localhost

2. **Permission Denied**
   - Check: Browser console shows `NotAllowedError`
   - Fix: User must grant camera permission in browser settings
   - iOS: Settings → Safari → Camera
   - Android: Site settings → Permissions → Camera
   - Desktop: Browser address bar → camera icon → allow

3. **Camera in Use**
   - Check: `NotReadableError` in console
   - Fix: Close other apps using camera (Zoom, Teams, etc.)

4. **CSP Blocks MediaStream**
   - Check: Console shows CSP violation for `blob:`
   - Fix: Ensure `media-src blob:` in CSP header

5. **Service Worker Stale Cache**
   - Check: Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)
   - Fix: Update service worker version in `public/service-worker.js`

### Torch Button Missing

**Expected Behavior:** Torch only appears on devices that expose `torch` capability

**Devices That Typically Support Torch:**
- Most Android phones (Chrome)
- Some Windows laptops with LED indicators

**Devices That Don't:**
- Most iPhones (iOS Safari doesn't expose `torch` in MediaStreamTrack capabilities)
- Desktop webcams without LED control

**Not a Bug:** If torch button doesn't appear, it means the device doesn't support programmatic torch control.

### Scans Not Detecting

**Symptoms:** Camera open, barcode in frame, no detection

**Fixes:**

1. **Lighting Too Dim**
   - Solution: Use torch (if available) or move to brighter area
   - Guideline: Barcode should be clearly visible to human eye

2. **Barcode Too Small/Far**
   - Solution: Move closer - barcode should fill ~60% of reticle
   - Optimal distance: 4-8 inches for retail barcodes

3. **Barcode Damaged/Faded**
   - Solution: Use manual input fallback
   - Ensure user can read digits clearly

4. **Wrong Barcode Type**
   - Supported: EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Code 39, ITF
   - Not supported: QR codes, Data Matrix, PDF417
   - Solution: Use manual input if format unsupported

### API Timeouts

**Symptoms:** Scan detects, stuck on "Looking up product..." for > 10s

**Debug Steps:**

1. Check network tab: `resolve-barcode` request pending?
2. Check edge function logs: slow OpenFoodFacts API response?
3. Check internet connection: network offline?

**Temporary Workaround:**
```javascript
// Feature flag in localStorage (emergency only)
localStorage.setItem('scanner-offline-mode', 'true');
// Shows manual input only, skips camera entirely
```

**Rollback Plan:**
- If widespread: disable scanner page via feature flag
- Update home page CTA to "Search by brand name" only
- Notify users: "Barcode scanner temporarily unavailable"

### Cooldown Cache Issues

**Symptoms:** Same barcode scanned repeatedly, always shows "Not found" (even if added to DB)

**Cause:** 60-second cooldown cache in `resolve-barcode` edge function

**Fix:**
- Wait 60 seconds and rescan
- Or restart edge function to clear in-memory cache
- Or update `notFoundCache` TTL from 60s to shorter duration

---

## Performance Benchmarks

### Scan Latency Targets

| Metric | Target | Acceptable | Alert If |
|--------|--------|------------|----------|
| Camera start → first frame | < 500ms | < 1s | > 2s |
| Barcode detect (well-lit) | < 2s | < 4s | > 10s |
| API resolve time | < 300ms | < 800ms | > 1.5s |
| Brand page prefetch | 0ms (instant) | < 200ms | N/A |
| Total scan → navigate | < 3s | < 5s | > 10s |

### Rate Limits

- **Client-side:** No hard limit (relies on server)
- **Edge function:** 10 requests per minute per IP
- **Cooldown cache:** Same "not found" barcode cached for 60s

---

## Emergency Controls

### Kill Switches

If scanner is causing issues in production:

1. **Disable Scanner Page** (temporary)
   ```sql
   -- Feature flag in app_config table (future)
   UPDATE app_config SET value='{"enabled":false}' WHERE key='scanner_enabled';
   ```
   Update home page to hide "Scan" button and show "Search only" mode

2. **Increase Rate Limits** (if legitimate traffic spike)
   ```typescript
   // In resolve-barcode/index.ts
   checkRateLimit(clientIp, 20, 60_000) // was 10
   ```

3. **Disable Cooldown Cache** (if causing stale data issues)
   ```typescript
   // Comment out in resolve-barcode/index.ts
   // if (isRecentNotFound(normalizedBarcode)) { ... }
   ```

### Rollback Procedure

1. Revert to last known good deployment
2. Check edge function logs for errors
3. Test on staging environment first
4. Gradual rollout: 10% → 50% → 100%

---

## Launch Day Checklist

### T-24 Hours
- [ ] Run full device test matrix (iPhone, Android, Desktop)
- [ ] Verify edge function logs are being ingested
- [ ] Set up monitoring alerts (error rate, P95 latency)
- [ ] Test rate limiting (burst test with 12+ requests)
- [ ] Confirm HTTPS and CSP headers in production

### T-1 Hour
- [ ] Smoke test on production domain
- [ ] Verify camera permissions flow on real devices
- [ ] Test manual input fallback
- [ ] Check service worker activation
- [ ] Confirm PWA installability

### Post-Launch (First 24 Hours)
- [ ] Monitor error logs every 2 hours
- [ ] Check miss rate (target < 40%)
- [ ] Verify rate limiting isn't blocking legitimate users
- [ ] Track manual input usage (should be < 20% of scans)
- [ ] Review A11y feedback (screen reader users)

### Week 1
- [ ] Analyze scan → navigate conversion rate
- [ ] Identify most-scanned brands (cache optimization)
- [ ] Review "not found" barcodes for mapping opportunities
- [ ] Optimize camera start latency based on device data
- [ ] Gather user feedback on scan UX

---

## Contact & Escalation

**If critical issue arises:**
1. Check this runbook for quick fixes
2. Review edge function logs: `fn="resolve-barcode" AND level="error"`
3. Check #incidents channel (if applicable)
4. Emergency rollback if needed (see above)

**Known Limitations (Document Clearly):**
- Torch support is device-dependent (not a bug)
- Camera requires HTTPS (by design)
- Some barcodes not in DB (user should report)
- 60s cooldown on repeated "not found" scans (anti-abuse)
