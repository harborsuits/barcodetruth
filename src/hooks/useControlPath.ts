import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ControlPathNode {
  depth: number;
  name: string;
  company_id: string;
  logo_url: string | null;
  ticker: string | null;
  is_public: boolean;
  relationship: string | null;
}

interface ControlPath {
  brand_id: string;
  path: ControlPathNode[];
  depth: number;
  updated_at: string;
}

export function useControlPath(brandId: string | undefined) {
  return useQuery({
    queryKey: ['control-path', brandId],
    queryFn: async () => {
      if (!brandId) return null;
      
      const { data, error } = await supabase
        .rpc('get_control_path' as any, {
          p_brand_id: brandId
        });

      if (error) {
        console.error('[useControlPath] Error fetching control path:', error);
        throw error;
      }

      return data as ControlPath | null;
    },
    enabled: !!brandId,
    staleTime: 1000 * 60 * 60, // 1 hour (cached)
  });
}
