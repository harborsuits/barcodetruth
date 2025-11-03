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
      
      // Get brand first to check if we have required data
      const { data: brand, error: brandError } = await supabase
        .from('brands')
        .select('wikidata_qid')
        .eq('id', brandId)
        .maybeSingle();
      
      if (brandError || !brand?.wikidata_qid) {
        console.log('[useKeyPeople] No wikidata_qid found, skipping company people query');
        return [];
      }

      // Find company by wikidata_qid
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('id')
        .eq('wikidata_qid', brand.wikidata_qid)
        .maybeSingle();
      
      if (companyError || !company?.id) {
        console.log('[useKeyPeople] No company found for wikidata_qid, returning empty');
        return [];
      }

      // Now safely query company_people with valid company_id
      const { data, error } = await supabase
        .from('company_people')
        .select('*')
        .eq('company_id', company.id)
        .limit(10);

      if (error) {
        console.error('[useKeyPeople] Error fetching company people:', error);
        return [];
      }

      return (data || []) as KeyPerson[];
    },
    enabled: !!brandId,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}
