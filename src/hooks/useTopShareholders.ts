import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Shareholder {
  investor_name: string;
  investor_company_id: string | null;
  pct: number | null;
  confidence: number;
  source: string;
  last_verified_at: string;
  is_asset_manager: boolean;
}

export function useTopShareholders(brandId: string | undefined, limit: number = 10) {
  return useQuery({
    queryKey: ['top-shareholders', brandId, limit],
    queryFn: async () => {
      if (!brandId) return [];
      
      const { data, error } = await supabase
        .rpc('get_top_shareholders' as any, {
          p_brand_id: brandId,
          p_limit: limit
        });

      if (error) {
        console.error('[useTopShareholders] Error fetching shareholders:', error);
        throw error;
      }

      return (data || []) as Shareholder[];
    },
    enabled: !!brandId,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}
