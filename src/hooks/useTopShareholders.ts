import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Shareholder {
  shareholder_id: string | null;
  holder_name: string;
  holder_type: string | null;
  percent_owned: number | null;
  as_of: string | null;
  source: string;
  last_updated: string;
  is_asset_manager: boolean;
  holder_wikidata_qid: string | null;
  wikipedia_url: string | null;
  holder_url: string | null;
  data_source: 'direct' | 'parent' | 'details_direct' | 'details_parent' | 'unknown';
}

export function useTopShareholders(brandId: string | undefined, limit: number = 10) {
  return useQuery({
    queryKey: ['top-shareholders', brandId, limit],
    queryFn: async () => {
      if (!brandId) return [];
      
      const { data, error } = await supabase
        .rpc('rpc_get_top_shareholders' as any, {
          entity_id: brandId,
          result_limit: limit
        });

      if (error) {
        console.error('[useTopShareholders] Error fetching shareholders:', error);
        // Return empty array instead of throwing to ensure uniform rendering
        return [];
      }

      return (data || []) as Shareholder[];
    },
    enabled: !!brandId,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}
