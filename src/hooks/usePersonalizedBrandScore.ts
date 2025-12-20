import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  computePersonalizedScore,
  computeCategoryScores,
  normalizeWeights,
  type CategoryVector,
  type UserWeights,
  type Dealbreakers,
  type ScoringResult,
} from "@/lib/personalizedScoring";

interface UserPreferences {
  weights: UserWeights;
  dealbreakers: Dealbreakers;
}

interface BrandVectors {
  baseline: CategoryVector;
  newsCache: CategoryVector;
}

/**
 * Fetch user preferences (weights + dealbreakers)
 */
async function fetchUserPreferences(userId: string): Promise<UserPreferences | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('cares_labor, cares_environment, cares_politics, cares_social, dealbreakers')
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;

  const rawWeights: CategoryVector = {
    labor: Number(data.cares_labor) || 50,
    environment: Number(data.cares_environment) || 50,
    politics: Number(data.cares_politics) || 50,
    social: Number(data.cares_social) || 50,
  };

  return {
    weights: normalizeWeights(rawWeights),
    dealbreakers: (data.dealbreakers as Dealbreakers) || {},
  };
}

/**
 * Fetch brand vectors (baseline + news cache)
 * 
 * IMPORTANT: Client never aggregates events directly.
 * The server job (recompute-brand-vectors edge function) owns the news_vector_cache.
 * This hook only reads the pre-computed cached vectors for performance.
 */
async function fetchBrandVectors(brandId: string): Promise<BrandVectors | null> {
  const { data, error } = await supabase
    .from('brands')
    .select('baseline_vector, news_vector_cache')
    .eq('id', brandId)
    .single();

  if (error || !data) return null;

  const defaultVector: CategoryVector = { labor: 0, environment: 0, politics: 0, social: 0 };

  return {
    baseline: (data.baseline_vector as unknown as CategoryVector) || defaultVector,
    newsCache: (data.news_vector_cache as unknown as CategoryVector) || defaultVector,
  };
}

/**
 * Main hook: compute personalized score for a user-brand pair
 */
export function usePersonalizedBrandScore(brandId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ['personalized-brand-score', brandId, userId],
    queryFn: async (): Promise<ScoringResult | null> => {
      if (!brandId || !userId) return null;

      // Fetch user preferences and brand vectors in parallel
      const [userPrefs, brandVectors] = await Promise.all([
        fetchUserPreferences(userId),
        fetchBrandVectors(brandId),
      ]);

      if (!userPrefs || !brandVectors) return null;

      // Compute category scores from baseline + news cache
      const categoryScores = computeCategoryScores(
        brandVectors.baseline,
        brandVectors.newsCache
      );

      // Compute personalized score
      return computePersonalizedScore(
        userPrefs.weights,
        categoryScores,
        userPrefs.dealbreakers
      );
    },
    enabled: !!brandId && !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to get default (non-personalized) brand score
 * Uses neutral weights for all categories
 */
export function useDefaultBrandScore(brandId: string | undefined) {
  return useQuery({
    queryKey: ['default-brand-score', brandId],
    queryFn: async (): Promise<ScoringResult | null> => {
      if (!brandId) return null;

      const brandVectors = await fetchBrandVectors(brandId);
      if (!brandVectors) return null;

      // Use equal weights for default score
      const neutralWeights: UserWeights = {
        labor: 0.25,
        environment: 0.25,
        politics: 0.25,
        social: 0.25,
      };

      const categoryScores = computeCategoryScores(
        brandVectors.baseline,
        brandVectors.newsCache
      );

      return computePersonalizedScore(neutralWeights, categoryScores);
    },
    enabled: !!brandId,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}
