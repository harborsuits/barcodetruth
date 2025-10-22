# Brand Profile Standard (Walmart Reference)

This document defines the standard features that should be consistently available across all brand profiles in the app, using Walmart as the reference implementation.

## Feature Checklist

### 1. Brand Header Section
- [x] **Brand Logo**: Display with fallback to monogram if missing
- [x] **Brand Name**: Primary heading with proper styling
- [x] **Website Link**: External link with icon when available
- [x] **Wikipedia Description**: Auto-enriched 200-character summary
  - Source attribution link to Wikipedia
  - Shows loading state while enriching

### 2. Scoring & Ratings
- [x] **Community Outlook Card**: Displays community ratings by category
  - Labor, Environment, Politics, Social categories
  - Shows confidence levels
- [x] **4 Category Score Cards**: Always visible grid (2x2)
  - Default to baseline 50 when no data
  - Shows event count per category
  - Clickable to filter evidence

### 3. Data Quality Indicators
- [x] **Data Collection Badge**: Shows when confidence < high
  - Event count (90d)
  - Categories covered
  - Monitoring sources count
  - Completeness percentage
  - Last ingestion timestamp

### 4. Ownership Module (New Standard)
The OwnershipTabs component now consolidates all ownership data:

#### a. Main Ownership Card
- [x] Company header (logo, name, type)
- [x] "Your purchase supports" banner (shows ultimate parent)
- [x] Ownership breakdown (for private companies)
- [x] Corporate structure chain (multi-level parents)
- [x] Sister brands display

#### b. Key People Section
- [x] CEO/Executives with photos
- [x] Founder(s) with photos
- [x] Role labels (CEO, Chair, Founder)
- [x] Clickable links to Wikipedia articles
- [x] Proper URL formatting (English Wikipedia)
- [x] Source attribution (Wikidata badge)

#### c. Top Shareholders Card (Separate)
- [x] List of institutional investors
- [x] Percentage ownership display
- [x] Asset manager badges
- [x] Clear disclaimer about passive investment
- [x] Links to shareholder websites/Wikipedia

### 5. Valuation
- [x] **Market Cap Chip**: Displays for public companies
  - Formatted currency display
  - As-of date
  - Source attribution

### 6. Coverage Metrics
- [x] **Event Count Badges**: 7d, 30d, 90d, 365d
- [x] **Verified Rate**: Percentage with 90d window
- [x] **Independent Sources**: Count of unique domains

### 7. Evidence Feed
- [x] **Category Filters**: 9+ category tabs
- [x] **Event Cards**: Title, date, source, verification
- [x] **Noise Tab**: Separate filter for financial/market news

---

## Data Requirements

### Database Tables (Must Exist)
1. `brands` - Core brand data
2. `brand_scores` - Category scores
3. `brand_events` - Evidence/events
4. `companies` - Parent company info
5. `company_ownership` - Ownership relationships
6. `company_people` - Key executives/founders
7. `company_shareholders` - Institutional investors
8. `company_valuation` - Market cap data

### RPC Functions (Must Work)
1. `brand_profile_view(brand_id)` - Main profile data
2. `get_brand_ownership(brand_id)` - Ownership structure
3. `get_brand_company_info(brand_id)` - Company details
4. `get_top_shareholders(brand_id, limit)` - Shareholder list
5. `personalized_brand_score(brand_id, user_id)` - User scores

### Enrichment Requirements
All brands should be enriched with:
1. **Wikipedia data**: Description, QID, logo
2. **Ownership data**: Parent company via Wikidata
3. **Key people**: CEO, founders with photos and QIDs
4. **Shareholders**: For public companies only
5. **Valuation**: Market cap for public companies

---

## UI Component Hierarchy

```
BrandProfile.tsx
├── BrandWikiEnrichment (auto-enriches missing data)
├── Card (Brand Header)
│   ├── BrandLogoWithFallback
│   ├── Brand Name
│   ├── Website Link
│   └── Wikipedia Description
├── CommunityOutlookCard
├── CategoryScoreCards (x4 grid)
├── DataCollectionBadge (conditional)
├── OwnershipTabs
│   ├── Main Ownership Card
│   │   ├── UnifiedOwnershipDisplay
│   │   ├── Corporate Structure
│   │   └── Sister Brands
│   ├── KeyPeopleRow Card
│   └── TopShareholdersCard (conditional)
├── ValuationChip (conditional)
├── Coverage Badges
└── Evidence Feed
```

---

## Consistency Checklist

When adding/updating brands, ensure:

- [ ] Logo resolution attempted (via resolve-brand-logo function)
- [ ] Wikipedia enrichment completed (description, QID)
- [ ] Ownership data enriched (if available in Wikidata)
- [ ] Key people added (CEO, founders minimum)
- [ ] Shareholders added (for public companies only)
- [ ] All Wikipedia/Wikidata links point to English content
- [ ] Default scores (50) shown when no events exist
- [ ] Data collection badge shows monitoring status
- [ ] Evidence feed has proper category filters

---

## Known Issues to Fix Across All Brands

1. **Wikipedia URLs**: Must construct from person names, not Wikidata QIDs
2. **Shareholder Data**: Only asset managers, never parent companies
3. **Control vs Investment**: Clear distinction in ownership display
4. **Missing Data Handling**: Graceful fallbacks for all sections
5. **Enrichment Quality**: Auto-enrich should populate all fields consistently

---

## Testing Checklist

For each brand profile:
1. Load time < 2 seconds
2. All images load or show fallbacks
3. All external links open correctly (Wikipedia, websites)
4. Ownership structure renders properly
5. Key people photos and links work
6. Shareholders display with correct badges
7. No console errors
8. Mobile responsive layout
9. Dark mode styling correct
10. Data quality indicators accurate
