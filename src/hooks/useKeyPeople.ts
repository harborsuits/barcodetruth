import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface KeyPerson {
  person_id: string | null;
  full_name: string;
  role: string;
  image_url: string | null;
  wikipedia_url: string | null;
  person_qid: string | null;
  source: string;
  last_updated: string;
  data_source: 'direct' | 'parent' | 'unknown';
}

export function useKeyPeople(brandId: string | undefined) {
  return useQuery({
    queryKey: ['key-people', brandId],
    queryFn: async () => {
      if (!brandId) return [];
      
      const { data, error } = await supabase
        .rpc('rpc_get_key_people' as any, {
          entity_id: brandId
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
