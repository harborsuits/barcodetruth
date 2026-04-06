/**
 * Source Tier Classification
 * 
 * Tier 1 (Score-driving): Official government/regulatory data
 *   - Can directly move dimension scores
 *   - OSHA, EPA, FDA, FEC, SEC, court records
 * 
 * Tier 2 (Corroborating): Reputable journalism
 *   - Can strengthen scored events but limited standalone score impact
 *   - NYT, Guardian, Reuters, AP, BBC, Bloomberg, WSJ
 * 
 * Tier 3 (Context-only): Social/aggregated/opinion
 *   - Appears in feed, minimal score impact
 *   - Reddit, generic RSS, opinion, finance content farms
 */

export type SourceTier = 'tier_1' | 'tier_2' | 'tier_3';

// Tier 1: Official / regulatory / government
const TIER_1_DOMAINS = [
  'osha.gov', 'epa.gov', 'fda.gov', 'fec.gov', 'sec.gov',
  'ftc.gov', 'dol.gov', 'doj.gov', 'nlrb.gov', 'cpsc.gov',
  'foodsafety.gov', 'usa.gov', 'ema.europa.eu',
  'courtlistener.com', 'pacer.gov',
];

// Tier 2: Reputable journalism
const TIER_2_DOMAINS = [
  'reuters.com', 'apnews.com', 'nytimes.com', 'washingtonpost.com',
  'wsj.com', 'ft.com', 'bbc.com', 'bbc.co.uk', 'theguardian.com',
  'bloomberg.com', 'npr.org', 'pbs.org', 'axios.com', 'politico.com',
  'propublica.org', 'theatlantic.com', 'newyorker.com',
  'economist.com', 'latimes.com', 'chicagotribune.com',
  'cnn.com', 'cbsnews.com', 'nbcnews.com', 'abcnews.go.com',
];

// Known Tier 3 (explicitly low-trust)
const TIER_3_DOMAINS = [
  'reddit.com', 'fool.com', 'seekingalpha.com', 'benzinga.com',
  'zacks.com', 'tipranks.com', 'marketwatch.com',
  'digitaljournal.com', 'prnewswire.com', 'businesswire.com',
  'globenewswire.com',
];

/**
 * Classify a source domain into a tier.
 * Unknown domains default to tier_3 (context-only).
 */
export function classifySourceTier(domain: string): SourceTier {
  const d = (domain || '').toLowerCase().replace(/^www\./, '');

  // Check .gov TLD as catch-all for government sources
  if (d.endsWith('.gov')) return 'tier_1';

  for (const t1 of TIER_1_DOMAINS) {
    if (d === t1 || d.endsWith('.' + t1)) return 'tier_1';
  }

  for (const t2 of TIER_2_DOMAINS) {
    if (d === t2 || d.endsWith('.' + t2)) return 'tier_2';
  }

  // Unknown domains are tier_3 by default
  return 'tier_3';
}

/**
 * Scoring weight multiplier per tier.
 * Tier 1 events get full scoring weight.
 * Tier 2 events get reduced but meaningful weight.
 * Tier 3 events get near-zero scoring weight (feed only).
 */
export const TIER_SCORE_WEIGHTS: Record<SourceTier, number> = {
  tier_1: 1.0,
  tier_2: 0.7,
  tier_3: 0.5, // LLM-classified events still contribute meaningfully
};

/**
 * Human-readable tier labels for UI
 */
export const TIER_LABELS: Record<SourceTier, string> = {
  tier_1: 'Official Source',
  tier_2: 'Reputable Media',
  tier_3: 'Context Signal',
};

/**
 * Check if an event meets score eligibility gates.
 * Returns true only if the event should materially affect dimension scores.
 */
export function isScoreEligible(event: {
  category?: string;
  is_irrelevant?: boolean;
  source_tier?: SourceTier;
  category_confidence?: number;
  category_impacts?: Record<string, number>;
}): boolean {
  // Gate 1: Must have a valid category
  if (!event.category || event.category === 'general') return false;

  // Gate 2: Must not be flagged as irrelevant/noise
  if (event.is_irrelevant) return false;

  // Gate 3: Must be Tier 1 or Tier 2 source
  if (!event.source_tier || event.source_tier === 'tier_3') return false;

  // Gate 4: Category confidence must be above threshold
  if ((event.category_confidence ?? 0) < 0.5) return false;

  // Gate 5: Must have nonzero impact in at least one dimension
  const impacts = event.category_impacts || {};
  const hasImpact = Object.values(impacts).some(v => v !== 0 && v !== undefined);
  if (!hasImpact) return false;

  return true;
}
