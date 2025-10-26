import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Shareholder {
  holder_name: string;
  holder_type: string | null;
  percent_owned: number | null;
  shares_owned: number | null;
  as_of: string | null;
  source: string;
  last_updated: string;
  is_asset_manager: boolean;
  holder_wikidata_qid: string | null;
  wikipedia_url: string | null;
  holder_url: string | null;
  data_source: string;
}

export function useTopShareholders(brandId: string | undefined, limit: number = 10) {
  return useQuery({
    queryKey: ['top-shareholders', brandId, limit],
    queryFn: async () => {
      if (!brandId) return [];
      
      const { data, error } = await supabase
        .rpc('rpc_get_top_shareholders' as any, {
          p_brand_id: brandId,
          p_limit: limit
        });

      if (error) {
        console.error('[useTopShareholders] Error fetching shareholders:', error);
        // Return empty array instead of throwing to ensure uniform rendering
        return [];
      }

      const rows = (data || []) as any[];
      // Normalize percent field: prefer percent_owned, fallback to pct from company_shareholders
      const normalized = rows.map((r) => ({
        ...r,
        percent_owned: (r.percent_owned ?? r.pct ?? null) as number | null,
      })) as Shareholder[];
      return normalized;
    },
    enabled: !!brandId,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}
