/**
 * Unified Alignment Scoring System (v3 — Hardened)
 * 
 * This is the SINGLE SOURCE OF TRUTH for calculating how well a brand
 * aligns with a user's preferences. All other scoring functions are deprecated.
 * 
 * Core principle: We are NOT rating brands as "good" or "bad".
 * We are calculating how closely a brand aligns with what the user personally cares about.
 * 
 * HARDENING RULES (v3):
 * 1. User preferences reweight DIMENSION SCORES, never raw events/articles
 * 2. Low-confidence dimensions are dampened toward neutral (50) before weighting
 * 3. Insufficient evidence cannot be over-amplified by slider extremes
 * 4. All sliders at zero → equal weight fallback
 * 5. Formula is identical server-side (personalized_brand_score_v2 RPC)
 */

// ============================================================================
// Types
// ============================================================================

export type Dimension = 'labor' | 'environment' | 'politics' | 'social';
export type ConfidenceLevel = 'low' | 'medium' | 'high';

export interface UserPreferences {
  // Dimension weights (0-100 scale from sliders)
  labor: number;
  environment: number;
  politics: number;
  social: number;
  
  // Optional hard stops - if brand scores below these, it's a dealbreaker
  dealbreakers?: {
    labor_min?: number;
    environment_min?: number;
    politics_min?: number;
    social_min?: number;
  };
}

export interface BrandDimensionScores {
  // Each dimension is 0-100 where:
  // 0 = worst possible track record
  // 50 = neutral/unknown/average
  // 100 = best possible track record
  score_labor: number | null;
  score_environment: number | null;
  score_politics: number | null;
  score_social: number | null;
  
  // Optional: per-dimension confidence
  confidence?: {
    labor?: ConfidenceLevel;
    environment?: ConfidenceLevel;
    politics?: ConfidenceLevel;
    social?: ConfidenceLevel;
  };
  
  // Optional: per-dimension event counts (from reason_json)
  eventCounts?: {
    labor?: number;
    environment?: number;
    politics?: number;
    social?: number;
  };
}

export interface AlignmentDriver {
  dimension: Dimension;
  label: string;
  impact: 'positive' | 'negative' | 'neutral';
  contribution: number;       // The weighted contribution to final score
  brandScore: number;         // The brand's score in this dimension
  effectiveScore: number;     // After confidence dampening
  userWeight: number;         // How much user cares (normalized 0-1)
  userWeightRaw: number;      // Original 0-100 weight
  confidence: ConfidenceLevel;
  coverageNote?: string;      // Human-readable coverage status
}

export interface DealBreakerResult {
  triggered: boolean;
  dimension?: Dimension;
  threshold?: number;
  actual?: number;
  message?: string;
}

export interface AlignmentResult {
  // Core score
  score: number;                          // 0-100 alignment percentage
  scoreRaw: number;                       // Before confidence adjustment
  
  // Confidence assessment
  confidence: ConfidenceLevel;            // Overall confidence in the score
  confidenceReason: string;               // Why this confidence level
  
  // Explainability
  drivers: AlignmentDriver[];             // What's driving the score
  topPositive?: AlignmentDriver;          // Biggest positive contributor
  topNegative?: AlignmentDriver;          // Biggest negative contributor
  
  // Dealbreakers
  dealbreaker: DealBreakerResult;
  
  // Data quality
  excludedDimensions: Dimension[];        // Dimensions with no evidence
  includedDimensions: Dimension[];        // Dimensions used in calculation
  
  // For display
  summary: string;                        // Human-readable summary
  isPersonalized: boolean;                // Whether this uses user prefs
  
  // Personalization explanation (v3)
  preferenceExplanation: string[];        // Lines explaining why score differs
}

// ============================================================================
// Constants
// ============================================================================

const DIMENSION_LABELS: Record<Dimension, string> = {
  labor: 'Labor Practices',
  environment: 'Environment',
  politics: 'Politics',
  social: 'Social Impact',
};

const DIMENSION_EMOJIS: Record<Dimension, string> = {
  labor: '👷',
  environment: '🌍',
  politics: '🏛️',
  social: '🤝',
};

/**
 * HARDENED confidence multipliers (v3)
 * 
 * Low confidence dimensions are dampened MORE aggressively toward neutral.
 * This prevents a user from maxing the Environment slider and getting a
 * misleading score from a brand that has only 1 weak news article about environment.
 * 
 * The multiplier blends the raw score toward 50 (neutral):
 *   effectiveScore = 50 + (rawScore - 50) * multiplier
 * 
 * So a brand with score=80, low confidence:
 *   effective = 50 + (80-50) * 0.5 = 65  (dampened toward neutral)
 */
export const CONFIDENCE_MULTIPLIERS: Record<ConfidenceLevel, number> = {
  low: 0.5,     // v2 was 0.85 — too weak. Now halves deviation from neutral
  medium: 0.85,  // v2 was 0.95
  high: 1.0,
};

// Default preferences when user hasn't set any (equal weight)
const DEFAULT_PREFERENCES: UserPreferences = {
  labor: 50,
  environment: 50,
  politics: 50,
  social: 50,
};

// Minimum event count per dimension for medium confidence
const MIN_EVENTS_MEDIUM = 2;
// Minimum event count per dimension for high confidence
const MIN_EVENTS_HIGH = 5;

// ============================================================================
// Core Calculation
// ============================================================================

/**
 * Normalize user weights to sum to 1.0
 * 
 * CRITICAL: Weights are RELATIVE, not absolute.
 * [100, 0, 0, 0] → [1.0, 0, 0, 0] — only labor matters
 * [50, 50, 50, 50] → [0.25, 0.25, 0.25, 0.25] — equal weight
 * [0, 0, 0, 0] → [0.25, 0.25, 0.25, 0.25] — safe fallback
 */
export function normalizeWeights(prefs: UserPreferences): Record<Dimension, number> {
  const total = prefs.labor + prefs.environment + prefs.politics + prefs.social;
  
  // If user set all to 0, use equal weights (safe fallback)
  if (total === 0) {
    return { labor: 0.25, environment: 0.25, politics: 0.25, social: 0.25 };
  }
  
  return {
    labor: prefs.labor / total,
    environment: prefs.environment / total,
    politics: prefs.politics / total,
    social: prefs.social / total,
  };
}

/**
 * Get confidence level for a dimension based on available data
 * 
 * Uses event counts when available (from reason_json.dimension_counts),
 * falls back to score heuristics.
 */
function getDimensionConfidence(
  dimension: Dimension,
  brandScores: BrandDimensionScores
): ConfidenceLevel {
  // If brand provides explicit confidence, use it
  if (brandScores.confidence?.[dimension]) {
    return brandScores.confidence[dimension]!;
  }
  
  // Use event counts if available (most accurate)
  const eventCount = brandScores.eventCounts?.[dimension];
  if (eventCount !== undefined) {
    if (eventCount >= MIN_EVENTS_HIGH) return 'high';
    if (eventCount >= MIN_EVENTS_MEDIUM) return 'medium';
    return 'low';
  }
  
  // Fallback: heuristic from score value
  const scoreKey = `score_${dimension}` as keyof BrandDimensionScores;
  const score = brandScores[scoreKey];
  
  if (score === null || score === undefined) return 'low';
  if (score === 50) return 'low'; // Neutral default = no real data
  
  return 'medium';
}

/**
 * HARDENED: Apply confidence dampening to a dimension score.
 * 
 * Blends toward neutral (50) based on confidence level.
 * This ensures weak evidence doesn't produce extreme effective scores
 * even when a user's slider is maxed.
 */
function dampenScore(rawScore: number, confidence: ConfidenceLevel): number {
  const multiplier = CONFIDENCE_MULTIPLIERS[confidence];
  return 50 + (rawScore - 50) * multiplier;
}

/**
 * Generate coverage note for a dimension
 */
function getCoverageNote(dimension: Dimension, confidence: ConfidenceLevel): string | undefined {
  if (confidence === 'low') {
    return `${DIMENSION_LABELS[dimension]} coverage is limited — weighted cautiously`;
  }
  if (confidence === 'medium') {
    return `${DIMENSION_LABELS[dimension]} has moderate evidence`;
  }
  return undefined;
}

/**
 * Check if any dealbreakers are triggered
 */
function checkDealbreakers(
  prefs: UserPreferences,
  brandScores: BrandDimensionScores
): DealBreakerResult {
  const dims: Dimension[] = ['labor', 'environment', 'politics', 'social'];
  
  for (const dim of dims) {
    const minKey = `${dim}_min` as keyof NonNullable<UserPreferences['dealbreakers']>;
    const threshold = prefs.dealbreakers?.[minKey];
    
    if (threshold !== undefined && threshold !== null) {
      const scoreKey = `score_${dim}` as keyof BrandDimensionScores;
      const actual = brandScores[scoreKey] as number | null;
      
      if (actual !== null && actual < threshold) {
        return {
          triggered: true,
          dimension: dim,
          threshold,
          actual,
          message: `${DIMENSION_LABELS[dim]} score (${Math.round(actual)}) is below your minimum (${threshold})`,
        };
      }
    }
  }
  
  return { triggered: false };
}

/**
 * Calculate overall confidence based on dimension confidences and coverage
 */
function calculateOverallConfidence(
  includedDims: Dimension[],
  dimensionConfidences: Record<Dimension, ConfidenceLevel>
): { level: ConfidenceLevel; reason: string } {
  if (includedDims.length < 3) {
    return {
      level: 'low',
      reason: `Only ${includedDims.length} of 4 dimensions have evidence`,
    };
  }
  
  const counts = { low: 0, medium: 0, high: 0 };
  for (const dim of includedDims) {
    counts[dimensionConfidences[dim]]++;
  }
  
  if (counts.high >= 2) {
    return { level: 'high', reason: 'Multiple dimensions have strong evidence' };
  }
  if (counts.low >= 2) {
    return { level: 'low', reason: 'Limited evidence across dimensions' };
  }
  
  return { level: 'medium', reason: 'Moderate evidence coverage' };
}

/**
 * Generate human-readable summary of alignment
 */
function generateSummary(
  score: number,
  dealbreaker: DealBreakerResult,
  topPositive?: AlignmentDriver,
  topNegative?: AlignmentDriver
): string {
  if (dealbreaker.triggered) {
    return `Does not meet your ${dealbreaker.dimension} requirements`;
  }
  
  if (score >= 80) {
    const boost = topPositive 
      ? `, especially in ${topPositive.label.toLowerCase()}`
      : '';
    return `Strong alignment with your values${boost}`;
  }
  
  if (score >= 60) {
    return topNegative
      ? `Good alignment overall, some concerns in ${topNegative.label.toLowerCase()}`
      : 'Good alignment with your values';
  }
  
  if (score >= 40) {
    return 'Mixed alignment – some values match, others don\'t';
  }
  
  const concern = topNegative
    ? `Primary concern: ${topNegative.label.toLowerCase()}`
    : 'Poor alignment with your values';
  return concern;
}

/**
 * Generate preference explanation lines (v3)
 * 
 * Explains WHY the personalized score differs from baseline:
 * - Which dimensions the user emphasized
 * - Which dimensions the brand is strong/weak in
 * - Which dimensions have limited coverage
 */
function generatePreferenceExplanation(
  drivers: AlignmentDriver[],
  isPersonalized: boolean,
  weights: Record<Dimension, number>
): string[] {
  if (!isPersonalized) {
    return ['Using equal weight across all dimensions (sign in to personalize)'];
  }
  
  const lines: string[] = [];
  
  // What the user emphasized
  const sortedByWeight = [...drivers].sort((a, b) => b.userWeight - a.userWeight);
  const topWeighted = sortedByWeight.filter(d => d.userWeight > 0.3);
  if (topWeighted.length > 0) {
    const names = topWeighted.map(d => d.label).join(' and ');
    lines.push(`Your preferences emphasize ${names}`);
  }
  
  // Brand strengths vs weaknesses relative to user preferences
  const strongForUser = drivers.filter(d => d.impact === 'positive' && d.userWeight > 0.15);
  const weakForUser = drivers.filter(d => d.impact === 'negative' && d.userWeight > 0.15);
  
  if (strongForUser.length > 0) {
    const name = strongForUser[0].label;
    lines.push(`This brand scores well in ${name}, which you care about`);
  }
  
  if (weakForUser.length > 0) {
    const name = weakForUser[0].label;
    lines.push(`This brand has concerns in ${name}, which matters to you`);
  }
  
  // Coverage warnings
  const lowCoverage = drivers.filter(d => d.confidence === 'low' && d.userWeight > 0.15);
  for (const d of lowCoverage) {
    lines.push(`${d.label} coverage is limited, so it was weighted cautiously`);
  }
  
  return lines.length > 0 ? lines : ['Score reflects your value preferences applied to evidence-based dimension scores'];
}

/**
 * MAIN FUNCTION: Calculate alignment between user preferences and brand scores
 * 
 * CANONICAL FORMULA (must match server-side RPC):
 * 1. Normalize user weights to sum to 1.0
 * 2. For each dimension with data:
 *    a. Get confidence level (from event counts or heuristics)
 *    b. Dampen score toward 50 based on confidence: effectiveScore = 50 + (raw - 50) * multiplier
 *    c. Contribution = effectiveScore * normalizedWeight
 * 3. If some dimensions excluded, renormalize remaining weights
 * 4. Final score = sum of contributions (0-100 scale)
 * 5. Check dealbreakers
 */
export function calculateAlignment(
  userPrefs: UserPreferences | null,
  brandScores: BrandDimensionScores
): AlignmentResult {
  const prefs = userPrefs ?? DEFAULT_PREFERENCES;
  const isPersonalized = userPrefs !== null;
  
  const weights = normalizeWeights(prefs);
  const dealbreaker = checkDealbreakers(prefs, brandScores);
  
  const dimensions: Dimension[] = ['labor', 'environment', 'politics', 'social'];
  const drivers: AlignmentDriver[] = [];
  const excludedDimensions: Dimension[] = [];
  const includedDimensions: Dimension[] = [];
  const dimensionConfidences: Record<Dimension, ConfidenceLevel> = {
    labor: 'low', environment: 'low', politics: 'low', social: 'low',
  };
  
  let rawScore = 0;
  let adjustedScore = 0;
  let totalWeight = 0;
  
  for (const dim of dimensions) {
    const scoreKey = `score_${dim}` as keyof BrandDimensionScores;
    const brandScore = brandScores[scoreKey] as number | null;
    const confidence = getDimensionConfidence(dim, brandScores);
    dimensionConfidences[dim] = confidence;
    
    // Skip dimensions with no data
    if (brandScore === null || brandScore === undefined) {
      excludedDimensions.push(dim);
      continue;
    }
    
    includedDimensions.push(dim);
    
    const weight = weights[dim];
    
    // HARDENED (v3): Dampen score based on confidence BEFORE weighting
    const effectiveScore = dampenScore(brandScore, confidence);
    
    const rawContribution = brandScore * weight;
    const adjustedContribution = effectiveScore * weight;
    
    rawScore += rawContribution;
    adjustedScore += adjustedContribution;
    totalWeight += weight;
    
    // Determine impact relative to neutral (50)
    let impact: 'positive' | 'negative' | 'neutral';
    if (brandScore >= 60) {
      impact = 'positive';
    } else if (brandScore <= 40) {
      impact = 'negative';
    } else {
      impact = 'neutral';
    }
    
    drivers.push({
      dimension: dim,
      label: DIMENSION_LABELS[dim],
      impact,
      contribution: adjustedContribution,
      brandScore,
      effectiveScore: Math.round(effectiveScore),
      userWeight: weight,
      userWeightRaw: prefs[dim],
      confidence,
      coverageNote: getCoverageNote(dim, confidence),
    });
  }
  
  // Normalize if not all dimensions included
  if (totalWeight > 0 && totalWeight < 1) {
    rawScore = rawScore / totalWeight;
    adjustedScore = adjustedScore / totalWeight;
  }
  
  // Sort drivers by absolute contribution (most impactful first)
  drivers.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  
  // Find top positive and negative drivers
  const positiveDrivers = drivers.filter(d => d.impact === 'positive');
  const negativeDrivers = drivers.filter(d => d.impact === 'negative');
  const topPositive = positiveDrivers[0];
  const topNegative = negativeDrivers[0];
  
  const { level: overallConfidence, reason: confidenceReason } = calculateOverallConfidence(
    includedDimensions, dimensionConfidences
  );
  
  const summary = generateSummary(adjustedScore, dealbreaker, topPositive, topNegative);
  const preferenceExplanation = generatePreferenceExplanation(drivers, isPersonalized, weights);
  
  return {
    score: Math.round(adjustedScore),
    scoreRaw: Math.round(rawScore),
    confidence: overallConfidence,
    confidenceReason,
    drivers,
    topPositive,
    topNegative,
    dealbreaker,
    excludedDimensions,
    includedDimensions,
    summary,
    isPersonalized,
    preferenceExplanation,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

export function getAlignmentColor(score: number): string {
  if (score >= 70) return 'text-green-600 dark:text-green-400';
  if (score >= 40) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

export function getAlignmentBgColor(score: number): string {
  if (score >= 70) return 'bg-green-100 dark:bg-green-950';
  if (score >= 40) return 'bg-amber-100 dark:bg-amber-950';
  return 'bg-red-100 dark:bg-red-950';
}

export function getConfidenceColor(level: ConfidenceLevel): string {
  switch (level) {
    case 'high': return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300';
    case 'medium': return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300';
    case 'low': return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
  }
}

export function getDimensionEmoji(dim: Dimension): string {
  return DIMENSION_EMOJIS[dim];
}

export function getDimensionLabel(dim: Dimension): string {
  return DIMENSION_LABELS[dim];
}

export function formatDelta(delta: number): string {
  return delta >= 0 ? `+${delta}` : `${delta}`;
}

export function isRecommendable(result: AlignmentResult): boolean {
  return !result.dealbreaker.triggered && result.includedDimensions.length >= 3;
}
