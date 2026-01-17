import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  AlignmentResult, 
  AlignmentDriver, 
  ConfidenceLevel, 
  Dimension,
  calculateAlignment,
  UserPreferences,
  BrandDimensionScores
} from "@/lib/alignmentScore";

/**
 * Hook to fetch the full alignment result for a brand
 * Uses the new personalized_brand_score_v2 RPC that returns JSONB
 */
export function useAlignmentScore(brandId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ['alignment-score', brandId, userId],
    queryFn: async (): Promise<AlignmentResult | null> => {
      if (!brandId) return null;
      
      const { data, error } = await supabase.rpc('personalized_brand_score_v2' as any, {
        p_brand_id: brandId,
        p_user_id: userId ?? null
      });
      
      if (error) {
        console.error('[useAlignmentScore] RPC error:', error);
        return null;
      }
      
      if (!data || data.score === null) {
        return null;
      }
      
      // Parse the JSONB result into our AlignmentResult type
      const result: AlignmentResult = {
        score: data.score as number,
        scoreRaw: data.scoreRaw as number,
        confidence: data.confidence as ConfidenceLevel,
        confidenceReason: data.confidenceReason as string,
        drivers: (data.drivers as AlignmentDriver[]).map(d => ({
          dimension: d.dimension as Dimension,
          label: d.label,
          impact: d.impact as 'positive' | 'negative' | 'neutral',
          contribution: d.contribution,
          brandScore: d.brandScore,
          userWeight: d.userWeight,
          userWeightRaw: d.userWeightRaw,
          confidence: d.confidence as ConfidenceLevel,
        })),
        topPositive: undefined,
        topNegative: undefined,
        dealbreaker: {
          triggered: data.dealbreaker?.triggered ?? false,
          dimension: data.dealbreaker?.dimension as Dimension | undefined,
          threshold: data.dealbreaker?.threshold,
          actual: data.dealbreaker?.actual,
          message: data.dealbreaker?.message,
        },
        excludedDimensions: data.excludedDimensions as Dimension[],
        includedDimensions: data.includedDimensions as Dimension[],
        summary: data.summary as string,
        isPersonalized: data.isPersonalized as boolean,
      };
      
      // Calculate top positive/negative from drivers
      const positiveDrivers = result.drivers.filter(d => d.impact === 'positive');
      const negativeDrivers = result.drivers.filter(d => d.impact === 'negative');
      
      if (positiveDrivers.length > 0) {
        result.topPositive = positiveDrivers.reduce((a, b) => 
          a.contribution > b.contribution ? a : b
        );
      }
      
      if (negativeDrivers.length > 0) {
        result.topNegative = negativeDrivers.reduce((a, b) => 
          Math.abs(a.contribution) > Math.abs(b.contribution) ? a : b
        );
      }
      
      return result;
    },
    enabled: !!brandId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to calculate alignment client-side from brand scores
 * Useful when you already have the brand data and user preferences loaded
 */
export function useClientSideAlignment(
  brandScores: BrandDimensionScores | null | undefined,
  userPrefs: UserPreferences | null | undefined
) {
  return useQuery({
    queryKey: ['client-alignment', brandScores, userPrefs],
    queryFn: () => {
      if (!brandScores) return null;
      return calculateAlignment(userPrefs ?? null, brandScores);
    },
    enabled: !!brandScores,
    staleTime: Infinity, // Pure calculation, no need to refetch
  });
}

/**
 * Hook to get user preferences for alignment calculation
 */
export function useUserPreferences(userId: string | undefined) {
  return useQuery({
    queryKey: ['user-preferences', userId],
    queryFn: async (): Promise<UserPreferences | null> => {
      if (!userId) return null;
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('cares_labor, cares_environment, cares_politics, cares_social')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (error) {
        console.error('[useUserPreferences] Error:', error);
        return null;
      }
      
      if (!data) return null;
      
      return {
        labor: data.cares_labor ?? 50,
        environment: data.cares_environment ?? 50,
        politics: data.cares_politics ?? 50,
        social: data.cares_social ?? 50,
      };
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}
