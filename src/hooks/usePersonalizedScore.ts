import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePersonalizedScore(brandId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ['personalized-score', brandId, userId],
    queryFn: async () => {
      if (!brandId || !userId) return null;
      
      const { data, error } = await supabase.rpc('personalized_brand_score' as any, {
        p_brand_id: brandId,
        p_user_id: userId
      });
      
      if (error) {
        console.error('[usePersonalizedScore] RPC error:', error);
        return null;
      }
      
      // Handle both scalar and array returns
      const result = Array.isArray(data) ? data[0] : data;
      console.log('[usePersonalizedScore] Result:', { brandId, userId, result });
      return result as number | null;
    },
    enabled: !!brandId && !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
