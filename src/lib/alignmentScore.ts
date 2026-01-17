/**
 * Unified Alignment Scoring System
 * 
 * This is the SINGLE SOURCE OF TRUTH for calculating how well a brand
 * aligns with a user's preferences. All other scoring functions are deprecated.
 * 
 * Core principle: We are NOT rating brands as "good" or "bad".
 * We are calculating how closely a brand aligns with what the user personally cares about.
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
}

export interface AlignmentDriver {
  dimension: Dimension;
  label: string;
  impact: 'positive' | 'negative' | 'neutral';
  contribution: number;       // The weighted contribution to final score
  brandScore: number;         // The brand's score in this dimension
  userWeight: number;         // How much user cares (normalized 0-1)
  userWeightRaw: number;      // Original 0-100 weight
  confidence: ConfidenceLevel;
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

// Confidence penalties - low confidence dimensions contribute less
const CONFIDENCE_MULTIPLIERS: Record<ConfidenceLevel, number> = {
  low: 0.85,
  medium: 0.95,
  high: 1.0,
};

// Default preferences when user hasn't set any (equal weight)
const DEFAULT_PREFERENCES: UserPreferences = {
  labor: 50,
  environment: 50,
  politics: 50,
  social: 50,
};

// ============================================================================
// Core Calculation
// ============================================================================

/**
 * Normalize user weights to sum to 1.0
 */
function normalizeWeights(prefs: UserPreferences): Record<Dimension, number> {
  const total = prefs.labor + prefs.environment + prefs.politics + prefs.social;
  
  // If user set all to 0, use equal weights
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
 */
function getDimensionConfidence(
  dimension: Dimension,
  brandScores: BrandDimensionScores
): ConfidenceLevel {
  // If brand provides explicit confidence, use it
  if (brandScores.confidence?.[dimension]) {
    return brandScores.confidence[dimension]!;
  }
  
  // Default to medium if we have a score, low if null
  const scoreKey = `score_${dimension}` as keyof BrandDimensionScores;
  const score = brandScores[scoreKey];
  
  if (score === null || score === undefined) {
    return 'low';
  }
  
  // If score is exactly 50 (neutral default), confidence is lower
  if (score === 50) {
    return 'low';
  }
  
  return 'medium';
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
      
      // If brand has a score and it's below threshold, dealbreaker triggered
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
  // If less than 3 dimensions have data, it's early stage
  if (includedDims.length < 3) {
    return {
      level: 'low',
      reason: `Only ${includedDims.length} of 4 dimensions have evidence`,
    };
  }
  
  // Count confidence levels
  const counts = { low: 0, medium: 0, high: 0 };
  for (const dim of includedDims) {
    counts[dimensionConfidences[dim]]++;
  }
  
  // Majority rules
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
 * MAIN FUNCTION: Calculate alignment between user preferences and brand scores
 */
export function calculateAlignment(
  userPrefs: UserPreferences | null,
  brandScores: BrandDimensionScores
): AlignmentResult {
  // Use defaults if no preferences provided
  const prefs = userPrefs ?? DEFAULT_PREFERENCES;
  const isPersonalized = userPrefs !== null;
  
  // Normalize weights
  const weights = normalizeWeights(prefs);
  
  // Check dealbreakers first
  const dealbreaker = checkDealbreakers(prefs, brandScores);
  
  // Calculate per-dimension contributions
  const dimensions: Dimension[] = ['labor', 'environment', 'politics', 'social'];
  const drivers: AlignmentDriver[] = [];
  const excludedDimensions: Dimension[] = [];
  const includedDimensions: Dimension[] = [];
  const dimensionConfidences: Record<Dimension, ConfidenceLevel> = {
    labor: 'low',
    environment: 'low',
    politics: 'low',
    social: 'low',
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
    const contribution = brandScore * weight;
    const confidenceMultiplier = CONFIDENCE_MULTIPLIERS[confidence];
    const adjustedContribution = contribution * confidenceMultiplier;
    
    rawScore += contribution;
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
      userWeight: weight,
      userWeightRaw: prefs[dim],
      confidence,
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
  
  // Calculate overall confidence
  const { level: overallConfidence, reason: confidenceReason } = calculateOverallConfidence(
    includedDimensions,
    dimensionConfidences
  );
  
  // Generate summary
  const summary = generateSummary(adjustedScore, dealbreaker, topPositive, topNegative);
  
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
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get display color for alignment score
 */
export function getAlignmentColor(score: number): string {
  if (score >= 70) return 'text-green-600 dark:text-green-400';
  if (score >= 40) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

/**
 * Get background color for alignment score
 */
export function getAlignmentBgColor(score: number): string {
  if (score >= 70) return 'bg-green-100 dark:bg-green-950';
  if (score >= 40) return 'bg-amber-100 dark:bg-amber-950';
  return 'bg-red-100 dark:bg-red-950';
}

/**
 * Get confidence badge color
 */
export function getConfidenceColor(level: ConfidenceLevel): string {
  switch (level) {
    case 'high': return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300';
    case 'medium': return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300';
    case 'low': return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
  }
}

/**
 * Get emoji for dimension
 */
export function getDimensionEmoji(dim: Dimension): string {
  return DIMENSION_EMOJIS[dim];
}

/**
 * Get label for dimension
 */
export function getDimensionLabel(dim: Dimension): string {
  return DIMENSION_LABELS[dim];
}

/**
 * Format score delta (e.g., "+12" or "-8")
 */
export function formatDelta(delta: number): string {
  return delta >= 0 ? `+${delta}` : `${delta}`;
}

/**
 * Check if a brand is "recommendable" (has enough evidence and no dealbreakers)
 */
export function isRecommendable(result: AlignmentResult): boolean {
  return !result.dealbreaker.triggered && result.includedDimensions.length >= 3;
}
