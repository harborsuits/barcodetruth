/**
 * Automated Event Filtering System
 * 
 * 4 layers that convert manual audit rules into automated pipeline logic:
 * 1. Entity Attribution — brand relevance scoring
 * 2. Deduplication — title similarity grouping
 * 3. Noise Category Filter — marketing/PR exclusion
 * 4. Evidence Ranking — impact-first ordering (handled in frontend)
 */

// ─── Layer 1: Entity Attribution ─────────────────────────────────────────────

/**
 * Scores how directly an event references a specific brand vs its parent.
 * 
 * +3 → exact brand name in title or description
 * +2 → brand product line reference (e.g., "Doritos Nacho Cheese")
 * +1 → parent company only (e.g., "PepsiCo" for Doritos)
 * 0  → no brand reference found
 */
export function computeBrandRelevanceScore(
  title: string,
  description: string,
  brandName: string,
  brandAliases: string[],
  parentName?: string | null
): number {
  const text = `${title} ${description}`.toLowerCase();
  const brandLower = brandName.toLowerCase();

  // Check exact brand name
  const brandRE = new RegExp(`\\b${escapeRegex(brandLower)}\\b`, 'i');
  if (brandRE.test(text)) return 3;

  // Check brand aliases (product lines, alternate names)
  for (const alias of brandAliases) {
    if (!alias || alias.length < 3) continue;
    const aliasRE = new RegExp(`\\b${escapeRegex(alias.toLowerCase())}\\b`, 'i');
    if (aliasRE.test(text)) return 2;
  }

  // Check parent company only
  if (parentName) {
    const parentLower = parentName.toLowerCase();
    const parentRE = new RegExp(`\\b${escapeRegex(parentLower)}\\b`, 'i');
    if (parentRE.test(text)) return 1;
  }

  return 0;
}

// ─── Layer 2: Marketing / PR Noise Detection ─────────────────────────────────

const MARKETING_NOISE_PATTERNS = [
  // Ad campaigns & sponsorships
  /\b(ad campaign|advertising|commercial|super bowl ad|sponsor(?:ship|ed|ing)|brand ambassador|endorsement|celebrity partner|influencer|brand deal)\b/i,
  // Product launches & promos
  /\b(new flavor|limited edition|product launch|launches new|introduces new|rolls out|debuts|unveils|announces new product|new packaging|rebrand(?:ing|ed)?)\b/i,
  // PR & marketing events
  /\b(press release|media event|brand activation|pop-up|experiential|sweepstakes|giveaway|promotion|promo(?:tional)?|coupon|discount offer|loyalty program)\b/i,
  // Awards & accolades (self-promotional)
  /\b(wins award|brand of the year|top brand|best brand|award-winning|recognized as|named best|certified|receives award)\b/i,
];

const MARKETING_EXCEPTION_PATTERNS = [
  // Keep if there's a controversy angle
  /\b(backlash|controversy|criticized|outrage|offensive|inappropriate|misleading|false advertising|deceptive|complaint|sued|lawsuit|ban(?:ned)?|pulled|removed|apologize|apology)\b/i,
];

/**
 * Detects if an event is marketing/PR noise that shouldn't affect trust scores.
 * Returns true if the event is marketing noise without controversy.
 */
export function isMarketingNoise(title: string, description: string): boolean {
  const text = `${title} ${description}`;
  
  const isMarketing = MARKETING_NOISE_PATTERNS.some(p => p.test(text));
  if (!isMarketing) return false;
  
  // Exception: keep if there's a controversy/backlash angle
  const hasControversy = MARKETING_EXCEPTION_PATTERNS.some(p => p.test(text));
  if (hasControversy) return false;
  
  return true;
}

// ─── Layer 3: Combined Pre-Score Filter ──────────────────────────────────────

export interface FilterResult {
  score_eligible: boolean;
  brand_relevance_score: number;
  is_marketing_noise: boolean;
  filter_reason?: string;
}

/**
 * Combined filter that runs all automated checks on an event.
 * This is the single entry point called during ingestion.
 */
export function applyEventFilters(
  title: string,
  description: string,
  brandName: string,
  brandAliases: string[],
  parentName: string | null | undefined,
  existingEligibility: boolean
): FilterResult {
  // Layer 1: Brand attribution
  const relevanceScore = computeBrandRelevanceScore(
    title, description, brandName, brandAliases, parentName
  );
  
  // Layer 2: Marketing noise
  const marketingNoise = isMarketingNoise(title, description);
  
  // Determine final eligibility
  let eligible = existingEligibility;
  let reason: string | undefined;
  
  // Kill events with no brand attribution (parent-only or unrelated)
  if (relevanceScore < 2) {
    eligible = false;
    reason = relevanceScore === 1 
      ? `Parent-only reference (${parentName}), not brand-specific`
      : 'No brand attribution found in event text';
  }
  
  // Kill marketing noise
  if (marketingNoise) {
    eligible = false;
    reason = 'Marketing/PR noise excluded from scoring';
  }
  
  return {
    score_eligible: eligible,
    brand_relevance_score: relevanceScore,
    is_marketing_noise: marketingNoise,
    filter_reason: reason,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}
