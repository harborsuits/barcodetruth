/**
 * Relevance scoring constants
 * These define the thresholds and scale for relevance scoring across the system.
 * 
 * CRITICAL: The relevance scale is 0-20 (integer), NOT 0-1 (normalized).
 * - relevance_score_raw: stored as integer 0-20 in database
 * - relevance_score_norm: auto-generated as raw/20.0 for UI display
 */

/**
 * Minimum relevance score (0-20 scale) required for an event to be accepted.
 * Events with scores below this threshold are marked as irrelevant.
 */
export const RELEVANCE_MIN_ACCEPTED = 11;

/**
 * Maximum relevance score on the raw scale
 */
export const RELEVANCE_MAX_SCORE = 20;

/**
 * Minimum relevance score on the raw scale
 */
export const RELEVANCE_MIN_SCORE = 0;

/**
 * Convert raw relevance score (0-20) to normalized score (0-1)
 */
export function normalizeRelevance(rawScore: number): number {
  return Math.round((rawScore / RELEVANCE_MAX_SCORE) * 10000) / 10000;
}

/**
 * Convert normalized relevance score (0-1) to raw score (0-20)
 */
export function denormalizeRelevance(normalizedScore: number): number {
  return Math.round(normalizedScore * RELEVANCE_MAX_SCORE);
}
