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
      
      // Get brand first to check if we have required data
      const { data: brand, error: brandError } = await supabase
        .from('brands')
        .select('wikidata_qid')
        .eq('id', brandId)
        .maybeSingle();
      
      if (brandError || !brand?.wikidata_qid) {
        console.log('[useTopShareholders] No wikidata_qid found, skipping shareholders query');
        return [];
      }

      // Find company by wikidata_qid
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('id')
        .eq('wikidata_qid', brand.wikidata_qid)
        .maybeSingle();
      
      if (companyError || !company?.id) {
        console.log('[useTopShareholders] No company found for wikidata_qid, returning empty');
        return [];
      }

      // Now safely query company_shareholders with valid company_id
      const { data, error } = await supabase
        .from('company_shareholders')
        .select('*')
        .eq('company_id', company.id)
        .order('ownership_percentage', { ascending: false, nullsFirst: false })
        .limit(limit);

      if (error) {
        console.error('[useTopShareholders] Error fetching shareholders:', error);
        return [];
      }

      const rows = (data || []) as any[];
      const normalized = rows.map((r) => ({
        ...r,
        percent_owned: (r.ownership_percentage ?? r.percent_owned ?? r.pct ?? null) as number | null,
      })) as Shareholder[];
      return normalized;
    },
    enabled: !!brandId,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}
