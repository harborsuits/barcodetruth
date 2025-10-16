import { getUserWeights, calculateValueFit } from "./valueFit";

interface BrandScores {
  score_labor: number;
  score_environment: number;
  score_politics: number;
  score_social: number;
}

interface Alternative {
  id: string;
  name: string;
  category?: string;
  barcode?: string;
  brandId: string;
  brandName: string;
  valueFit: number;
  scores: BrandScores;
  reasons: string;
}

export async function getAlternatives(
  currentBrandId: string,
  category?: string,
  excludeSameParent: boolean = true
): Promise<Alternative[]> {
  const API = import.meta.env.VITE_SUPABASE_URL + "/functions/v1/v1-brands";
  const userWeights = getUserWeights();

  // Fetch trending brands (already verified with events)
  const trendingRes = await fetch(`${API}/trending?limit=100`);
  if (!trendingRes.ok) {
    console.error('Error fetching trending brands');
    return [];
  }
  
  const trending = await trendingRes.json();
  
  // Filter out current brand and get details for each
  const pool = trending.filter((b: any) => b.brand_id !== currentBrandId);
  
  // Sort by verified signals: events_30d desc, verified_rate desc, trend_score desc
  pool.sort((a: any, b: any) => {
    const eventsDelta = (b.events_30d || 0) - (a.events_30d || 0);
    if (eventsDelta !== 0) return eventsDelta;
    
    const verifiedDelta = (b.verified_rate || 0) - (a.verified_rate || 0);
    if (verifiedDelta !== 0) return verifiedDelta;
    
    return (b.trend_score || 0) - (a.trend_score || 0);
  });

  // Take top candidates and fetch full details
  const candidates = pool.slice(0, 20);
  const alternatives: Alternative[] = [];

  for (const candidate of candidates) {
    try {
      const res = await fetch(`${API}/brands/${candidate.brand_id}`);
      if (!res.ok) continue;
      
      const brandData = await res.json();
      
      // Skip if no verified events/evidence (realOnly gate)
      if (!brandData.last_event_at || !brandData.score) continue;

      // Calculate value fit using verified score (no defaults!)
      const scores: BrandScores = {
        score_labor: brandData.score,
        score_environment: brandData.score,
        score_politics: brandData.score,
        score_social: brandData.score,
      };
      
      const valueFit = calculateValueFit(scores, userWeights);

      alternatives.push({
        id: candidate.brand_id,
        name: brandData.name,
        category: undefined,
        barcode: undefined,
        brandId: candidate.brand_id,
        brandName: brandData.name,
        valueFit,
        scores,
        reasons: generateReasons(scores, userWeights),
      });

      // Stop once we have enough
      if (alternatives.length >= 10) break;
    } catch (err) {
      console.error('Error fetching brand details:', err);
      continue;
    }
  }

  // Sort by value fit
  alternatives.sort((a, b) => b.valueFit - a.valueFit);

  return alternatives.slice(0, 10);
}

function generateReasons(scores: BrandScores, weights: any): string {
  const categories = [
    { key: 'labor' as const, label: 'Labor', score: scores.score_labor, weight: weights.labor },
    { key: 'environment' as const, label: 'Environment', score: scores.score_environment, weight: weights.environment },
    { key: 'politics' as const, label: 'Politics', score: scores.score_politics, weight: weights.politics },
    { key: 'social' as const, label: 'Social', score: scores.score_social, weight: weights.social },
  ];

  // Find top categories by weighted score
  const topCategories = categories
    .filter(c => c.weight > 0.1)
    .sort((a, b) => (b.score * b.weight) - (a.score * a.weight))
    .slice(0, 2);

  if (topCategories.length === 0) return "Better overall alignment";

  const reasons = topCategories
    .filter(c => c.score >= 60)
    .map(c => `${c.label} score: ${c.score}`);

  return reasons.length > 0 ? reasons.join(', ') : "Better overall alignment";
}
