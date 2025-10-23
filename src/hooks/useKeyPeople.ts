import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface KeyPerson {
  person_qid: string | null;
  person_name: string;
  role: string;
  title: string | null;
  seniority: string | null;
  start_date: string | null;
  end_date: string | null;
  source: string;
  last_updated: string;
  image_url: string | null;
}

export function useKeyPeople(brandId: string | undefined) {
  return useQuery({
    queryKey: ['key-people', brandId],
    queryFn: async () => {
      if (!brandId) return [];
      
      // Primary: optimized RPC
      const { data, error } = await supabase
        .rpc('rpc_get_key_people' as any, {
          p_brand_id: brandId
        });

      if (error) {
        console.error('[useKeyPeople] Error fetching key people (rpc_get_key_people):', error);
        // Return empty array instead of throwing to ensure uniform rendering
        return [] as KeyPerson[];
      }

      const rpcPeople = (data || []) as KeyPerson[];
      if (rpcPeople.length > 0) return rpcPeople;

      // Fallback: fetch via broader company info RPC (covers brands without explicit parent link)
      try {
        const { data: companyInfo, error: infoError } = await supabase
          .rpc('get_brand_company_info' as any, { p_brand_id: brandId });
        if (infoError) {
          console.warn('[useKeyPeople] Fallback company info RPC failed:', infoError);
          return [] as KeyPerson[];
        }
        const fallbackPeople = ((companyInfo as any)?.people || []) as KeyPerson[];
        if (fallbackPeople.length > 0) {
          console.log('[useKeyPeople] Using fallback people from company info:', fallbackPeople.length);
        }
        return fallbackPeople;
      } catch (e) {
        console.warn('[useKeyPeople] Fallback exception:', e);
        return [] as KeyPerson[];
      }
    },
    enabled: !!brandId,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}
