export type SliderKey = 'labor' | 'environment' | 'politics' | 'social';
export type Verification = 'unverified' | 'corroborated' | 'official';

export interface Weights {
  labor: number;
  environment: number;
  politics: number;
  social: number;
}

/**
 * Apply event impact to slider scores with verification factor
 * @param baseScores Current slider scores (0-100)
 * @param eventImpact Impact values from event (-20 to +20)
 * @param verification Event verification level
 * @param sourceCount Number of sources for the event
 * @returns Updated slider scores
 */
export function applyEventImpact(
  baseScores: Weights,
  eventImpact: Partial<Weights>,
  verification: Verification,
  sourceCount: number
): Weights {
  // Verification factors (research-backed neutrality policy)
  const factor = 
    verification === 'official' ? 1.0 :        // Official sources: full impact
    verification === 'corroborated' ? 0.75 :   // Corroborated: 75% impact
    sourceCount === 1 ? 0.0 :                  // Single unverified: no impact (warning only)
    0.25;                                       // Multiple unverified: 25% impact

  const next = { ...baseScores };
  
  for (const key of ['labor', 'environment', 'politics', 'social'] as const) {
    const delta = (eventImpact[key] ?? 0) * factor;
    // Cap per-event absolute impact to ±20 points
    const cappedDelta = Math.max(-20, Math.min(20, delta));
    next[key] = Math.max(0, Math.min(100, next[key] + cappedDelta));
  }
  
  return next;
}

/**
 * Calculate overall score from slider scores and user weights
 * @param sliderScores Current slider scores
 * @param userWeights User's preference weights for each category
 * @returns Weighted overall score (0-100)
 */
export function calculateOverallScore(
  sliderScores: Weights,
  userWeights: Weights
): number {
  const sumWeights = Object.values(userWeights).reduce((a, b) => a + b, 0) || 1;
  
  const weighted = (
    sliderScores.labor * userWeights.labor +
    sliderScores.environment * userWeights.environment +
    sliderScores.politics * userWeights.politics +
    sliderScores.social * userWeights.social
  ) / sumWeights;
  
  return Math.round(Math.max(0, Math.min(100, weighted)));
}

/**
 * Check if a brand score is stale (>30 days old)
 * @param lastUpdated ISO date string of last update
 * @returns true if stale, false otherwise
 */
export function isScoreStale(lastUpdated?: string): boolean {
  if (!lastUpdated) return true;
  const daysSince = (Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
  return daysSince > 30;
}

/**
 * Get days since last update
 * @param lastUpdated ISO date string
 * @returns Number of days or undefined if invalid
 */
export function daysSinceUpdate(lastUpdated?: string): number | undefined {
  if (!lastUpdated) return undefined;
  try {
    return Math.floor((Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24));
  } catch {
    return undefined;
  }
}
