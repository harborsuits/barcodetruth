interface UserValues {
  value_labor: number;      // 0-100
  value_environment: number; // 0-100
  value_politics: number;    // 0-100
  value_social: number;      // 0-100
}

interface BrandScores {
  score_labor: number;      // 0-100
  score_environment: number; // 0-100
  score_politics: number;    // 0-100
  score_social: number;      // 0-100
}

export interface MatchResult {
  overall_match: number; // 0-100
  category_matches: {
    labor: { gap: number; severity: string; userCares: boolean };
    environment: { gap: number; severity: string; userCares: boolean };
    politics: { gap: number; severity: string; userCares: boolean };
    social: { gap: number; severity: string; userCares: boolean };
  };
  recommendation: 'aligned' | 'neutral' | 'misaligned';
}

export function calculateValueMatch(
  userValues: UserValues,
  brandScores: BrandScores
): MatchResult {
  // Calculate gap for each category
  const laborGap = Math.abs(userValues.value_labor - brandScores.score_labor);
  const envGap = Math.abs(userValues.value_environment - brandScores.score_environment);
  const polGap = Math.abs(userValues.value_politics - brandScores.score_politics);
  const socialGap = Math.abs(userValues.value_social - brandScores.score_social);
  
  // Determine if user cares about each category (threshold: > 20 away from neutral 50)
  const caresLabor = Math.abs(userValues.value_labor - 50) > 20;
  const caresEnv = Math.abs(userValues.value_environment - 50) > 20;
  const caresPol = Math.abs(userValues.value_politics - 50) > 20;
  const caresSocial = Math.abs(userValues.value_social - 50) > 20;
  
  // Weight gaps by how much user cares
  const weightedGaps = [
    caresLabor ? laborGap : laborGap * 0.3,
    caresEnv ? envGap : envGap * 0.3,
    caresPol ? polGap : polGap * 0.3,
    caresSocial ? socialGap : socialGap * 0.3,
  ];
  
  // Overall match (inverted gap - lower gap = higher match)
  const avgGap = weightedGaps.reduce((a, b) => a + b) / weightedGaps.length;
  const overallMatch = 100 - avgGap;
  
  // Categorize each gap
  const categorizeSeverity = (gap: number, userCares: boolean): string => {
    if (!userCares) return 'neutral';
    if (gap < 15) return 'good_match';
    if (gap < 30) return 'minor_mismatch';
    if (gap < 50) return 'moderate_mismatch';
    return 'major_mismatch';
  };
  
  return {
    overall_match: Math.round(overallMatch),
    category_matches: {
      labor: {
        gap: laborGap,
        severity: categorizeSeverity(laborGap, caresLabor),
        userCares: caresLabor
      },
      environment: {
        gap: envGap,
        severity: categorizeSeverity(envGap, caresEnv),
        userCares: caresEnv
      },
      politics: {
        gap: polGap,
        severity: categorizeSeverity(polGap, caresPol),
        userCares: caresPol
      },
      social: {
        gap: socialGap,
        severity: categorizeSeverity(socialGap, caresSocial),
        userCares: caresSocial
      }
    },
    recommendation: 
      overallMatch >= 70 ? 'aligned' :
      overallMatch >= 40 ? 'neutral' :
      'misaligned'
  };
}
