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

function normalizeWeights(raw: { labor: number; environment: number; politics: number; social: number }): UserWeights {
  // Convert from 0-100 scale to normalized 0-1 scale
  const total = raw.labor + raw.environment + raw.politics + raw.social;
  if (total === 0) return DEFAULT_WEIGHTS;
  
  return {
    labor: raw.labor / total,
    environment: raw.environment / total,
    politics: raw.politics / total,
    social: raw.social / total,
  };
}

export function getUserWeights(): UserWeights {
  if (typeof window === 'undefined') return DEFAULT_WEIGHTS;
  
  // Try loading from Settings page format (0-100 scale)
  const userValues = localStorage.getItem('userValues');
  if (userValues) {
    try {
      const parsed = JSON.parse(userValues);
      return normalizeWeights(parsed);
    } catch {
      // Continue to fallback
    }
  }
  
  // Legacy fallback
  const stored = localStorage.getItem('user_weights');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // Continue to fallback
    }
  }
  
  return DEFAULT_WEIGHTS;
}

export function setUserWeights(weights: UserWeights) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('user_weights', JSON.stringify(weights));
}

export function calculateValueFit(scores: BrandScores, weights: UserWeights): number {
  // Verified-only: If any score is null/undefined, return neutral
  if (scores.score_labor == null || scores.score_environment == null || 
      scores.score_politics == null || scores.score_social == null) {
    return 50;
  }
  
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

export function getTopContributors(currentScores: BrandScores, altScores: BrandScores, weights: UserWeights): string {
  const categories = [
    { key: 'labor' as const, label: 'Labor' },
    { key: 'environment' as const, label: 'Environment' },
    { key: 'politics' as const, label: 'Politics' },
    { key: 'social' as const, label: 'Social' },
  ];

  const deltas = categories.map(({ key, label }) => ({
    label,
    delta: (altScores[`score_${key}`] - currentScores[`score_${key}`]) * weights[key],
    rawDelta: altScores[`score_${key}`] - currentScores[`score_${key}`],
  }));

  deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const top = deltas.slice(0, 2).filter(d => Math.abs(d.rawDelta) >= 3);
  if (!top.length) return "Similar across all categories.";

  const parts = top.map(d => 
    `${d.rawDelta > 0 ? 'Better' : 'Worse'} on ${d.label} (${d.rawDelta > 0 ? '+' : ''}${d.rawDelta})`
  );

  return parts.join(', ') + '.';
}

export function getScoreDelta(currentScore: number, alternativeScore: number): number {
  return alternativeScore - currentScore;
}

export function formatDelta(delta: number): string {
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta}`;
}
