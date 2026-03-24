

# UI Redesign Plan — Match "Forensic Editorial" Reference Design

The screenshot shows 5 screens: **Onboarding**, **Home/Discover**, **Auth**, **Scanner**, and **Brand Profile**. Comparing against the current implementation, the design is already close in spirit (dark forensic dossier), but needs refinement across all 5 screens to match the reference exactly.

---

## What Changes

### 1. Onboarding Page
**Current:** Slider cards with colored dimension accents, standard layout.
**Target:** Cleaner forensic layout with:
- Header: `FORENSIC_EDITORIAL` branding top-left
- Subheader: `WEIGHT_DISTRIBUTION_PROTOCOL`
- Title: "Configure Personal Alignment Weights" with descriptive paragraph
- Four dimension sliders (Worker Rights, Environment, Political, Social) each with:
  - Dimension icon + label row with live tags (e.g., `LABOR_STANDARDS_INDEX`)
  - Sub-labels: `COMPLIANCE_WEIGHT`, `CRITICAL_RATIO`
  - Score display (e.g., `85%`) with percentage indicators
  - Smaller sub-text labels below each
- Bottom CTA: `FINALIZE ALIGNMENT MODEL →` button
- Footer note about analytics

**Changes needed:**
- Restyle `Onboarding.tsx` ValueCard components to match monospaced forensic labels
- Add protocol-style headers
- Replace colorful slider cards with forensic-styled metric cards showing percentages
- Add `FINALIZE ALIGNMENT MODEL` CTA

### 2. Home / Discover Page
**Current:** Hero section with barcode accent, search, trending preview, recent verifications, how-it-works.
**Target:**
- Top: `FORENSIC_EDITORIAL` header with navigation
- Tab bar: `DISCOVER` / `MY SCANS`
- Subheader: `SYSTEM_ACCESS: GRANTED` label
- Title: "Forensic Audit: Global Brands"
- Search bar with magnifying glass
- `TRENDING INVESTIGATIONS` section with brand cards showing:
  - Score badge, brand name, short description, `TRUST_SCORE` label
  - Shield/verified icons
- `RECENT VERIFICATIONS` section with materiality cards (MATERIAL, MINOR, etc.)
- `THE FORENSIC PROCESS` section with 3 steps: SCAN → AUDIT → ALIGN
- Bottom nav: SCANNER, SEARCH, TRENDING, SETTINGS, ADMIN

**Changes needed:**
- Add `SYSTEM_ACCESS: GRANTED` label above hero
- Restyle trending cards to show `TRUST_SCORE` with score number prominently
- Restyle recent verifications with materiality badges (HOW MATERIAL, MATERIAL, MINOR)
- Restyle "How It Works" to "THE FORENSIC PROCESS" with SCAN/AUDIT/ALIGN steps
- Bottom nav already exists — minor label tweaks

### 3. Auth Page
**Current:** Standard card with email/password fields, Google auth.
**Target:**
- Header: `BARCODE_TRUTH` monospaced branding
- Subheader: `SYSTEM_MANIFEST: THE DOSSIER`
- Title: "Authenticate Your Identity"
- Fields styled as:
  - `ACCESS_IDENTIFIER` (email)
  - `SECURITY_KEY` (password)
  - `SMART_REPORTING_KEY` label
- `INITIALIZE SESSION` primary button
- Divider: `OR CONTINUE WITH`
- `GOOGLE VERIFICATION` button
- Link: "New Investigator? Register Account"

**Changes needed:**
- Restyle `Auth.tsx` with forensic labels for form fields
- Change button text to `INITIALIZE SESSION`
- Change headings to forensic terminology
- Style Google button as `GOOGLE VERIFICATION`
- Add `SYSTEM_MANIFEST` subtitle

### 4. Scanner Page
**Current:** Camera viewfinder with corner brackets, manual barcode input.
**Target:**
- Header: `FORENSIC_EDITORIAL` with red close button
- Subheader: `INVESTIGATOR_MODULE` / `ACTIVE_SESSION_ONLINE`
- Camera viewfinder (already exists)
- Status text: "Data transmitted over secure HTTPS. No images stored."
- Label: `SYSTEM_STATUS` with "System Ready for Ingestion" text
- Barcode input: `Enter Barcode Identifier...`
- `INITIALIZE AUDIT` green/primary button
- Tags below: `BOOK_TAP_TEST_MATTERS`
- Brand chips: `COCA-COLA`, `NESTLE`, `PEPSI`
- Bottom nav with icons: SCANNER, SEARCH, TRENDING, SETTINGS, ADMIN

**Changes needed:**
- Add forensic header labels (`INVESTIGATOR_MODULE`, `ACTIVE_SESSION_ONLINE`)
- Change manual input placeholder to `Enter Barcode Identifier...`
- Change submit button to `INITIALIZE AUDIT`
- Add brand quick-chips below input
- Add security text about HTTPS

### 5. Brand Profile Page
**Current:** Report header, score hero, 2x2 metric grid, overview, power metrics, evidence, alternatives.
**Target:** Very close to current, but with refinements:
- Back arrow + `FORENSIC_EDITORIAL` header with logo top-right
- Report ID: `ID: TRT_RPTID`
- Brand name large (e.g., "Nestlé") with domain link
- Description paragraph in a bordered card
- `ALIGNMENT_INDEX` section with large score (e.g., `28`), `LOW ALIGNMENT` badge, `VIEW ALTERNATIVES` button
- `FORENSIC METRIC DISTRIBUTION` header (uppercase, monospaced, with date)
  - Each dimension as a row (not 2x2 grid): label + severity badge on right, description text, score as `18 / 100`
- `FORENSIC EVIDENCE REPOSITORY` section with evidence cards showing:
  - Source badge (THE GUARDIAN, AP NEWS, REUTERS)
  - Date
  - Headline
  - `SOURCE_DATA →` link
- `LOAD FULL AUDIT TRAIL` button at bottom

**Changes needed:**
- Switch metric distribution from 2x2 grid to **stacked rows** (each dimension full-width)
- Add description text per dimension (e.g., "Systemic analysis of labor practices...")
- Show score as `18 / 100` format
- Evidence cards: add source name badge, restyle with `SOURCE_DATA →` links
- Add `VIEW ALTERNATIVES` button near score
- Add `LOAD FULL AUDIT TRAIL` at bottom of evidence

---

## Technical Approach

All changes are CSS/layout/copy changes within existing components. No new database tables, no new edge functions, no new routes.

**Files to modify:**
1. `src/pages/Onboarding.tsx` — Restyle ValueCard, add protocol headers
2. `src/pages/Home.tsx` + `src/components/landing/HeroSection.tsx` — Add forensic labels, restyle sections
3. `src/components/landing/HowItWorks.tsx` — Rename to "THE FORENSIC PROCESS"
4. `src/components/landing/TrendingPreview.tsx` — Add TRUST_SCORE display
5. `src/components/landing/RecentVerifications.tsx` — Add materiality badges
6. `src/pages/Auth.tsx` — Forensic field labels, button text
7. `src/pages/Scan.tsx` — Forensic headers, input labels, quick-chips
8. `src/pages/BrandProfileV1.tsx` — Switch metrics to stacked rows, add dimension descriptions, restyle evidence, add VIEW ALTERNATIVES + LOAD FULL AUDIT TRAIL buttons

**No changes to:**
- Database schema
- Edge functions
- Design tokens / color palette (already correct)
- Routing

