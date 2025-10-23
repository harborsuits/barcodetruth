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
      
      const { data, error } = await supabase
        .rpc('rpc_get_key_people' as any, {
          p_brand_id: brandId
        });

      if (error) {
        console.error('[useKeyPeople] Error fetching key people:', error);
        // Return empty array instead of throwing to ensure uniform rendering
        return [];
      }

      return (data || []) as KeyPerson[];
    },
    enabled: !!brandId,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}
