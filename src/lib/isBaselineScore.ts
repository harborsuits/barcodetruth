/**
 * Shared baseline score detector.
 * A brand is "baseline" when all dimensions sit at exactly 50 —
 * meaning no real scoring pipeline has run yet.
 * 
 * This is the single source of truth for score-state rendering.
 */

export interface ScoreDimensions {
  overall?: number | null;
  score_labor?: number | null;
  score_environment?: number | null;
  score_politics?: number | null;
  score_social?: number | null;
  labor?: number | null;
  environment?: number | null;
  politics?: number | null;
  social?: number | null;
}

/**
 * Returns true when all available dimension scores are exactly 50,
 * indicating no real data has differentiated this brand from its
 * neutral starting state.
 */
export function isBaselineScore(scores: ScoreDimensions | null | undefined): boolean {
  if (!scores) return true;

  const overall = scores.overall ?? null;
  const labor = scores.score_labor ?? scores.labor ?? null;
  const environment = scores.score_environment ?? scores.environment ?? null;
  const politics = scores.score_politics ?? scores.politics ?? null;
  const social = scores.score_social ?? scores.social ?? null;

  // If everything is null, treat as baseline (no data)
  if (overall === null && labor === null && environment === null && politics === null && social === null) {
    return true;
  }

  // If overall is 50 AND all present dimensions are 50, it's baseline
  const isFlat50 = (v: number | null) => v === null || v === 50;

  return isFlat50(overall) && isFlat50(labor) && isFlat50(environment) && isFlat50(politics) && isFlat50(social);
}

/**
 * Nullify a score if it's baseline, for rendering purposes.
 * Returns null for baseline scores, the original value otherwise.
 */
export function effectiveScore(score: number | null | undefined, scores: ScoreDimensions | null | undefined): number | null {
  if (isBaselineScore(scores)) return null;
  return score ?? null;
}
