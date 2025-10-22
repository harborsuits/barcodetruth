import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface OwnershipChainNode {
  id: string;
  name: string;
  type: 'brand' | 'company';
  logo_url?: string;
  is_public?: boolean;
  ticker?: string;
  relation?: string;
  percent?: number;
  source?: string;
  confidence?: number;
}

interface ShareholderBucket {
  key: 'institutional' | 'insider' | 'strategic' | 'gov' | 'other';
  percent: number;
  source_name?: string;
  source_url?: string;
}

interface TopHolder {
  name: string;
  type: string;
  percent: number;
  url?: string;
  official_url?: string;
  wikipedia_url?: string;
  wikidata_qid?: string;
  logo_url?: string;
  source_name?: string;
  source_url?: string;
}

interface OwnershipData {
  company_id: string | null;
  structure: {
    chain: OwnershipChainNode[];
    siblings: OwnershipChainNode[];
  };
  shareholders: {
    subject_company?: string;
    as_of?: string;
    buckets?: ShareholderBucket[];
    top?: TopHolder[];
  };
}

export function useOwnership(brandId: string | undefined) {
  return useQuery({
    queryKey: ['ownership', brandId],
    queryFn: async () => {
      if (!brandId) return null;
      
      const { data, error } = await supabase
        .rpc('get_brand_ownership' as any, {
          p_brand_id: brandId
        });

      console.debug('[Ownership] brandId=', brandId, 'error=', error, 'data=', data);

      if (error) {
        console.error('[useOwnership] Error fetching ownership:', error);
        throw error;
      }

      return data as OwnershipData | null;
    },
    enabled: !!brandId,
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}
