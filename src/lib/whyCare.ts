// Generate personalized "Why Should I Care" explanations
import { analytics } from '@/lib/analytics';

type CategoryKey = 'labor' | 'environment' | 'politics' | 'social';

interface UserValues {
  labor: number;
  environment: number;
  politics: number;
  social: number;
  political_intensity?: number;
  political_alignment?: number;
}

interface BrandScores {
  score_labor: number;
  score_environment: number;
  score_politics: number;
  score_social: number;
  politics_intensity?: number | null;
  politics_alignment?: number | null;
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
  
  // Handle non-politics categories
  const categories: Array<{key: CategoryKey, userKey: keyof UserValues, brandKey: keyof BrandScores}> = [
    { key: 'labor', userKey: 'labor', brandKey: 'score_labor' },
    { key: 'environment', userKey: 'environment', brandKey: 'score_environment' },
    { key: 'social', userKey: 'social', brandKey: 'score_social' },
  ];
  
  categories.forEach(({ key, userKey, brandKey }) => {
    const uv = userVals[userKey] as number;
    const bv = brandScores[brandKey] as number;
    
    // Only show if user cares (> 20 away from neutral 50)
    const cares = Math.abs(uv - 50) > 20;
    const gap = Math.abs(uv - bv);
    
    if (!cares || gap < 20) return;
    
    const direction = uv > bv ? 'higher' : 'lower';
    const label = CATEGORY_LABELS[key];
    
    let explanation: string;
    if (direction === 'higher') {
      explanation = `You value ${label} more than this brand delivers`;
    } else {
      explanation = `This brand scores higher on ${label} than you prefer`;
    }
    
    bullets.push({
      category: key,
      label,
      gap,
      direction,
      explanation
    });
  });
  
  // Handle politics - use two-axis if available, otherwise fall back to legacy
  const hasNewPolitics = 
    userVals.political_intensity !== undefined && 
    userVals.political_alignment !== undefined;
    
  if (hasNewPolitics) {
    // Two-axis politics: check both intensity and alignment
    const userIntensity = userVals.political_intensity!;
    const userAlignment = userVals.political_alignment!;
    const brandIntensity = brandScores.politics_intensity ?? 50;
    const brandAlignment = brandScores.politics_alignment ?? 50;
    
    const intensityGap = Math.abs(userIntensity - brandIntensity);
    const alignmentGap = Math.abs(userAlignment - brandAlignment);
    
    const caresIntensity = Math.abs(userIntensity - 50) > 20;
    const caresAlignment = Math.abs(userAlignment - 50) > 20;
    
    // Add intensity mismatch if significant
    if (caresIntensity && intensityGap > 20) {
      // Track mismatch
      analytics.trackPoliticsIntensityMismatch(intensityGap, userIntensity, brandIntensity);
      
      const direction = userIntensity > brandIntensity ? 'higher' : 'lower';
      const explanation = direction === 'higher'
        ? 'You prefer more politically active brands'
        : 'You prefer less politically active brands';
      
      bullets.push({
        category: 'politics',
        label: 'political activity level',
        gap: intensityGap,
        direction,
        explanation
      });
    }
    
    // Add alignment mismatch if significant
    if (caresAlignment && alignmentGap > 20) {
      // Track mismatch
      analytics.trackPoliticsAlignmentMismatch(alignmentGap, userAlignment, brandAlignment);
      
      const direction = userAlignment > brandAlignment ? 'higher' : 'lower';
      const explanation = direction === 'higher'
        ? 'You lean traditional, but this brand leans progressive'
        : 'You lean progressive, but this brand leans traditional';
      
      bullets.push({
        category: 'politics',
        label: 'political alignment',
        gap: alignmentGap,
        direction,
        explanation
      });
    }
  } else {
    // Legacy single politics score
    const uv = userVals.politics;
    const bv = brandScores.score_politics;
    const cares = Math.abs(uv - 50) > 20;
    const gap = Math.abs(uv - bv);
    
    if (cares && gap >= 20) {
      const direction = uv > bv ? 'higher' : 'lower';
      const label = CATEGORY_LABELS.politics;
      
      let explanation: string;
      if (direction === 'higher') {
        explanation = `You value ${label} more than this brand delivers`;
      } else {
        explanation = `This brand scores higher on ${label} than you prefer`;
      }
      
      bullets.push({
        category: 'politics',
        label,
        gap,
        direction,
        explanation
      });
    }
  }
  
  // Sort by gap size, return top 3
  return bullets
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 3);
}

export function shouldShowWhyCare(userVals: UserValues): boolean {
  // Check standard categories
  const standardCategories: Array<keyof Pick<UserValues, 'labor' | 'environment' | 'social'>> = 
    ['labor', 'environment', 'social'];
  
  if (standardCategories.some(cat => Math.abs(userVals[cat] - 50) > 20)) {
    return true;
  }
  
  // Check two-axis politics if available
  if (userVals.political_intensity !== undefined && userVals.political_alignment !== undefined) {
    return Math.abs(userVals.political_intensity - 50) > 20 || 
           Math.abs(userVals.political_alignment - 50) > 20;
  }
  
  // Fall back to legacy politics
  return Math.abs(userVals.politics - 50) > 20;
}
