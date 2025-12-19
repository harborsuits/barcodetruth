/**
 * Personalized Scoring System
 * 
 * Implements the formula from the Master Spec:
 * - Event Effective Contribution: E[e,c] = impact * severity * credibility * verification_factor * recency_decay
 * - Brand Category Score: CatScore[b,c] = Baseline[b,c] + News[b,c]
 * - Personalized Score: PersonalScore[u,b] = Σ(W[u,c] * CatScore[b,c])
 * - Final Score: 50 + 50 * tanh(PersonalScore / k)
 */

export type Category = 'labor' | 'environment' | 'politics' | 'social';

export interface CategoryVector {
  labor: number;
  environment: number;
  politics: number;
  social: number;
}

export interface UserWeights extends CategoryVector {}

export interface Dealbreakers {
  labor?: number;
  environment?: number;
  politics?: number;
  social?: number;
}

export interface EventScore {
  category_impacts: Partial<CategoryVector>;
  severity: number;      // 0-1
  credibility: number;   // 0-1
  verification_factor: number; // verified=1, corroborated=0.75, other=0.5, noise=0.1
  event_date: string;
}

export interface CategoryContribution {
  category: Category;
  weight: number;
  score: number;
  contribution: number;
  isPositive: boolean;
}

export interface ScoringResult {
  personalScore: number;        // 0-100 friendly score
  rawScore: number;             // Raw weighted sum
  categoryScores: CategoryVector;
  contributions: CategoryContribution[];
  topPositive: CategoryContribution[];
  topNegative: CategoryContribution[];
  dealbreaker: { triggered: boolean; category?: Category; threshold?: number };
}

// Constants
const HALF_LIFE_DAYS = 45;
const SCORE_SCALE_K = 1.0;
const CATEGORIES: Category[] = ['labor', 'environment', 'politics', 'social'];

/**
 * Calculate recency decay factor using exponential decay
 */
export function recencyDecay(eventDate: string, halfLifeDays = HALF_LIFE_DAYS): number {
  const now = Date.now();
  const eventTime = new Date(eventDate).getTime();
  const ageDays = (now - eventTime) / (1000 * 60 * 60 * 24);
  return Math.exp(-ageDays * Math.LN2 / halfLifeDays);
}

/**
 * Calculate effective contribution of an event for a specific category
 */
export function eventEffectiveContribution(
  event: EventScore,
  category: Category
): number {
  const impact = event.category_impacts[category] ?? 0;
  const decay = recencyDecay(event.event_date);
  return impact * event.severity * event.credibility * event.verification_factor * decay;
}

/**
 * Aggregate events into a news vector for a brand
 */
export function aggregateNewsVector(
  events: EventScore[],
  cap = 5 // Cap per category to prevent single-story domination
): CategoryVector {
  const vector: CategoryVector = { labor: 0, environment: 0, politics: 0, social: 0 };
  
  for (const event of events) {
    for (const cat of CATEGORIES) {
      const contribution = eventEffectiveContribution(event, cat);
      vector[cat] += contribution;
    }
  }
  
  // Clamp each category
  for (const cat of CATEGORIES) {
    vector[cat] = Math.max(-cap, Math.min(cap, vector[cat]));
  }
  
  return vector;
}

/**
 * Combine baseline and news vectors into final category scores
 */
export function computeCategoryScores(
  baseline: CategoryVector,
  newsVector: CategoryVector
): CategoryVector {
  return {
    labor: baseline.labor + newsVector.labor,
    environment: baseline.environment + newsVector.environment,
    politics: baseline.politics + newsVector.politics,
    social: baseline.social + newsVector.social,
  };
}

/**
 * Normalize user weights to 0-1 range (from 0-100 cares_* values)
 */
export function normalizeWeights(raw: CategoryVector): UserWeights {
  return {
    labor: raw.labor / 100,
    environment: raw.environment / 100,
    politics: raw.politics / 100,
    social: raw.social / 100,
  };
}

/**
 * Main scoring function: compute personalized score for a user-brand pair
 */
export function computePersonalizedScore(
  userWeights: UserWeights,
  categoryScores: CategoryVector,
  dealbreakers?: Dealbreakers
): ScoringResult {
  // Calculate contributions per category
  const contributions: CategoryContribution[] = CATEGORIES.map(cat => {
    const weight = userWeights[cat];
    const score = categoryScores[cat];
    const contribution = weight * score;
    return {
      category: cat,
      weight,
      score,
      contribution,
      isPositive: contribution >= 0,
    };
  });

  // Sort by absolute contribution for top drivers
  const sorted = [...contributions].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  const topPositive = sorted.filter(c => c.isPositive).slice(0, 3);
  const topNegative = sorted.filter(c => !c.isPositive).slice(0, 3);

  // Raw weighted sum
  const rawScore = contributions.reduce((sum, c) => sum + c.contribution, 0);

  // Convert to 0-100 using tanh transform
  const personalScore = 50 + 50 * Math.tanh(rawScore / SCORE_SCALE_K);

  // Check dealbreakers
  let dealbreaker: ScoringResult['dealbreaker'] = { triggered: false };
  if (dealbreakers) {
    for (const cat of CATEGORIES) {
      const threshold = dealbreakers[cat];
      if (threshold !== undefined && categoryScores[cat] < -threshold) {
        dealbreaker = { triggered: true, category: cat, threshold };
        break;
      }
    }
  }

  return {
    personalScore: Math.round(personalScore),
    rawScore,
    categoryScores,
    contributions,
    topPositive,
    topNegative,
    dealbreaker,
  };
}

/**
 * Get friendly label for a category
 */
export function getCategoryLabel(cat: Category): string {
  const labels: Record<Category, string> = {
    labor: 'Labor & Workers',
    environment: 'Environment',
    politics: 'Political Activity',
    social: 'Social Responsibility',
  };
  return labels[cat];
}

/**
 * Get emoji for a category
 */
export function getCategoryEmoji(cat: Category): string {
  const emojis: Record<Category, string> = {
    labor: '👷',
    environment: '🌱',
    politics: '🏛️',
    social: '🤝',
  };
  return emojis[cat];
}

/**
 * Format contribution as a human-readable explanation
 */
export function formatContributionExplanation(contribution: CategoryContribution): string {
  const label = getCategoryLabel(contribution.category);
  const direction = contribution.isPositive ? 'helps' : 'hurts';
  const intensity = Math.abs(contribution.contribution);
  
  if (intensity < 0.1) return `${label}: minimal impact`;
  if (intensity < 0.3) return `${label}: slight ${direction === 'helps' ? 'positive' : 'negative'} impact`;
  if (intensity < 0.6) return `${label}: moderate ${direction === 'helps' ? 'positive' : 'negative'} impact`;
  return `${label}: significant ${direction === 'helps' ? 'positive' : 'negative'} impact`;
}

/**
 * Get verification factor from verification level
 */
export function getVerificationFactor(verification: string | null): number {
  switch (verification) {
    case 'official': return 1.0;
    case 'corroborated': return 0.75;
    case 'unverified': return 0.5;
    default: return 0.1; // noise
  }
}

/**
 * Map event severity string to numeric value
 */
export function getSeverityValue(severity: string | null): number {
  switch (severity?.toLowerCase()) {
    case 'critical': return 1.0;
    case 'high': return 0.8;
    case 'medium': return 0.5;
    case 'low': return 0.3;
    default: return 0.5;
  }
}

/**
 * Get credibility based on source domain heuristics
 */
export function getSourceCredibility(sourceDomain: string | null): number {
  if (!sourceDomain) return 0.5;
  
  // Tier 1: Official/government sources
  const tier1 = ['gov', 'sec.gov', 'epa.gov', 'osha.gov', 'ftc.gov', 'fda.gov'];
  if (tier1.some(d => sourceDomain.includes(d))) return 1.0;
  
  // Tier 2: Major news outlets
  const tier2 = ['reuters.com', 'apnews.com', 'nytimes.com', 'wsj.com', 'bloomberg.com', 'bbc.com', 'theguardian.com'];
  if (tier2.some(d => sourceDomain.includes(d))) return 0.9;
  
  // Tier 3: Industry/trade publications
  const tier3 = ['business', 'industry', 'trade', 'journal'];
  if (tier3.some(d => sourceDomain.includes(d))) return 0.7;
  
  // Default for unknown sources
  return 0.5;
}
