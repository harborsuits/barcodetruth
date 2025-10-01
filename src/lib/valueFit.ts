export interface UserWeights {
  labor: number;
  environment: number;
  politics: number;
  social: number;
}

export interface BrandScores {
  score_labor: number;
  score_environment: number;
  score_politics: number;
  score_social: number;
}

const DEFAULT_WEIGHTS: UserWeights = {
  labor: 0.25,
  environment: 0.25,
  politics: 0.25,
  social: 0.25,
};

export function getUserWeights(): UserWeights {
  if (typeof window === 'undefined') return DEFAULT_WEIGHTS;
  
  const stored = localStorage.getItem('user_weights');
  if (!stored) return DEFAULT_WEIGHTS;
  
  try {
    return JSON.parse(stored);
  } catch {
    return DEFAULT_WEIGHTS;
  }
}

export function setUserWeights(weights: UserWeights) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('user_weights', JSON.stringify(weights));
}

export function calculateValueFit(scores: BrandScores, weights: UserWeights): number {
  return Math.round(
    scores.score_labor * weights.labor +
    scores.score_environment * weights.environment +
    scores.score_politics * weights.politics +
    scores.score_social * weights.social
  );
}

export function getValueFitLabel(score: number): { label: string; color: string; icon: string } {
  if (score >= 70) return { label: "Great fit", color: "text-[var(--success)]", icon: "✓" };
  if (score >= 50) return { label: "Mixed", color: "text-[var(--warn)]", icon: "~" };
  return { label: "Not a fit", color: "text-[var(--danger)]", icon: "×" };
}

export function getScoreDelta(currentScore: number, alternativeScore: number): number {
  return alternativeScore - currentScore;
}

export function formatDelta(delta: number): string {
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta}`;
}
