// Generate personalized "Why Should I Care" explanations

type CategoryKey = 'labor' | 'environment' | 'politics' | 'social';

interface UserValues {
  labor: number;
  environment: number;
  politics: number;
  social: number;
}

interface BrandScores {
  score_labor: number;
  score_environment: number;
  score_politics: number;
  score_social: number;
}

export interface WhyCareBullet {
  category: CategoryKey;
  label: string;
  gap: number;
  direction: 'higher' | 'lower';
  explanation: string;
}

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  labor: 'workers & labor practices',
  environment: 'sustainability & climate',
  politics: 'political spending & lobbying',
  social: 'DEI & social impact'
};

export function buildWhyCare(
  userVals: UserValues,
  brandScores: BrandScores
): WhyCareBullet[] {
  const bullets: WhyCareBullet[] = [];
  
  (Object.keys(userVals) as CategoryKey[]).forEach(cat => {
    const uv = userVals[cat];
    const bv = brandScores[`score_${cat}`];
    
    // Only show if user cares (> 20 away from neutral 50)
    const cares = Math.abs(uv - 50) > 20;
    const gap = Math.abs(uv - bv);
    
    if (!cares || gap < 20) return;
    
    const direction = uv > bv ? 'higher' : 'lower';
    const label = CATEGORY_LABELS[cat];
    
    let explanation: string;
    if (direction === 'higher') {
      explanation = `You value ${label} more than this brand delivers`;
    } else {
      explanation = `This brand scores higher on ${label} than you prefer`;
    }
    
    bullets.push({
      category: cat,
      label,
      gap,
      direction,
      explanation
    });
  });
  
  // Sort by gap size, return top 3
  return bullets
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 3);
}

export function shouldShowWhyCare(userVals: UserValues): boolean {
  // Only show if user has set preferences (not all neutral)
  const categories = Object.keys(userVals) as CategoryKey[];
  return categories.some(cat => Math.abs(userVals[cat] - 50) > 20);
}
