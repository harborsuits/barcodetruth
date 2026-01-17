import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProfileTierData {
  tier: 'full' | 'preview';
  completeness: {
    has_description: boolean;
    has_logo: boolean;
    has_website: boolean;
    has_wikidata: boolean;
    evidence_count: number;
    distinct_domains: number;
    has_pillars: boolean;
  };
  confidence: 'early' | 'growing' | 'strong';
  enrichment_stage: string | null;
  created_at: string | null;
  parent_company: string | null;
}

export function useProfileTier(brandId: string | null | undefined) {
  return useQuery({
    queryKey: ['brand-tier', brandId],
    queryFn: async (): Promise<ProfileTierData | null> => {
      if (!brandId) return null;
      
      const { data, error } = await supabase.rpc('get_brand_profile_tier', {
        p_brand_id: brandId
      } as any);
      
      if (error) {
        console.error('Error fetching profile tier:', error);
        return null;
      }
      
      return data as unknown as ProfileTierData;
    },
    enabled: !!brandId,
    staleTime: 60 * 1000, // Cache for 1 minute
  });
}
