import { supabase } from "@/integrations/supabase/client";
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
  const userWeights = getUserWeights();

  // Get parent IDs for current brand
  let parentIds: string[] = [];
  if (excludeSameParent) {
    const { data: parentEdges } = await supabase
      .from('brand_ownerships')
      .select('parent_brand_id')
      .eq('brand_id', currentBrandId);
    
    if (parentEdges) {
      parentIds = parentEdges.map(e => e.parent_brand_id);
    }
  }

  // Build query for alternative products
  let query = supabase
    .from('products')
    .select(`
      id,
      name,
      category,
      barcode,
      brand_id,
      brands!inner(
        id,
        name,
        brand_scores!inner(
          score_labor,
          score_environment,
          score_politics,
          score_social
        )
      )
    `)
    .neq('brand_id', currentBrandId);

  if (category) {
    query = query.eq('category', category);
  }

  const { data: products, error } = await query;

  if (error || !products) {
    console.error('Error fetching alternatives:', error);
    return [];
  }

  // Filter out brands with same parent
  const alternatives: Alternative[] = [];
  
  for (const product of products) {
    const brand = product.brands as any;
    const brandScores = brand.brand_scores?.[0];
    
    if (!brandScores) continue;

    // Check if this brand shares a parent
    let skipDueToParent = false;
    if (excludeSameParent && parentIds.length > 0) {
      const { data: altParents } = await supabase
        .from('brand_ownerships')
        .select('parent_brand_id')
        .eq('brand_id', brand.id)
        .in('parent_brand_id', parentIds);
      
      if (altParents && altParents.length > 0) {
        skipDueToParent = true;
      }
    }

    if (skipDueToParent) continue;

    const valueFit = calculateValueFit(brandScores, userWeights);
    
    alternatives.push({
      id: product.id,
      name: product.name,
      category: product.category,
      barcode: product.barcode,
      brandId: brand.id,
      brandName: brand.name,
      valueFit,
      scores: brandScores,
      reasons: generateReasons(brandScores, userWeights)
    });
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
