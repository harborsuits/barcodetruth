import { FEATURES } from '@/lib/featureFlags';

interface UserValues {
  value_labor: number;
  value_environment: number;
  value_politics: number;
  value_social: number;
  value_political_intensity?: number;
  value_political_alignment?: number;
}

interface BrandScores {
  score_labor: number;
  score_environment: number;
  score_politics: number;
  score_social: number;
  politics_intensity?: number | null;
  politics_alignment?: number | null;
}

export interface MatchResult {
  overall_match: number;
  category_matches: {
    labor: { gap: number; severity: string; userCares: boolean };
    environment: { gap: number; severity: string; userCares: boolean };
    politics: { gap: number; severity: string; userCares: boolean };
    social: { gap: number; severity: string; userCares: boolean };
  };
  recommendation: 'aligned' | 'neutral' | 'misaligned';
}

const CARE_THRESHOLD = 20;
const SOFT_WEIGHT = 0.3;

function careWeight(userValue: number): number {
  return Math.abs(userValue - 50) > CARE_THRESHOLD ? 1 : SOFT_WEIGHT;
}

function gap(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null || b == null) return null;
  return Math.abs(a - b);
}

export function calculateValueMatch(
  userValues: UserValues,
  brandScores: BrandScores
): MatchResult {
  const parts: number[] = [];
  const weights: number[] = [];

  // Labor
  const laborGap = Math.abs(userValues.value_labor - brandScores.score_labor);
  const caresLabor = Math.abs(userValues.value_labor - 50) > CARE_THRESHOLD;
  const laborWeight = careWeight(userValues.value_labor);
  parts.push((100 - laborGap) * laborWeight);
  weights.push(laborWeight);

  // Environment
  const envGap = Math.abs(userValues.value_environment - brandScores.score_environment);
  const caresEnv = Math.abs(userValues.value_environment - 50) > CARE_THRESHOLD;
  const envWeight = careWeight(userValues.value_environment);
  parts.push((100 - envGap) * envWeight);
  weights.push(envWeight);

  // Social
  const socialGap = Math.abs(userValues.value_social - brandScores.score_social);
  const caresSocial = Math.abs(userValues.value_social - 50) > CARE_THRESHOLD;
  const socialWeight = careWeight(userValues.value_social);
  parts.push((100 - socialGap) * socialWeight);
  weights.push(socialWeight);

  // Politics - TWO dimensions (intensity + alignment) if available
  let polGap: number;
  let caresPol: boolean;

  const hasNewPolitics = 
    userValues.value_political_intensity !== undefined && 
    userValues.value_political_alignment !== undefined;

  if (FEATURES.POLITICS_TWO_AXIS && hasNewPolitics) {
    // Use two-axis politics
    const userIntensity = userValues.value_political_intensity!;
    const userAlignment = userValues.value_political_alignment!;
    const brandIntensity = brandScores.politics_intensity ?? 50;
    const brandAlignment = brandScores.politics_alignment ?? 50;

    const gi = Math.abs(userIntensity - brandIntensity);
    const ga = Math.abs(userAlignment - brandAlignment);

    const intensityWeight = careWeight(userIntensity);
    const alignmentWeight = careWeight(userAlignment);

    parts.push((100 - gi) * intensityWeight);
    weights.push(intensityWeight);

    parts.push((100 - ga) * alignmentWeight);
    weights.push(alignmentWeight);

    // Combined gap for display
    polGap = Math.round((gi + ga) / 2);
    caresPol = 
      Math.abs(userIntensity - 50) > CARE_THRESHOLD || 
      Math.abs(userAlignment - 50) > CARE_THRESHOLD;
  } else {
    // Fallback to legacy single politics score
    polGap = Math.abs(userValues.value_politics - brandScores.score_politics);
    caresPol = Math.abs(userValues.value_politics - 50) > CARE_THRESHOLD;
    const polWeight = careWeight(userValues.value_politics);
    parts.push((100 - polGap) * polWeight);
    weights.push(polWeight);
  }

  // Calculate overall match
  const weightedTotal = parts.reduce((a, b) => a + b, 0);
  const maxPerPart = 100;
  const maxTotal = weights.reduce((a, w) => a + maxPerPart * w, 0);
  const overallMatch = Math.max(0, Math.min(100, Math.round((weightedTotal / maxTotal) * 100)));

  // Categorize severity
  const categorizeSeverity = (gap: number, userCares: boolean): string => {
    if (!userCares) return 'neutral';
    if (gap < 15) return 'good_match';
    if (gap < 30) return 'minor_mismatch';
    if (gap < 50) return 'moderate_mismatch';
    return 'major_mismatch';
  };

  return {
    overall_match: overallMatch,
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
