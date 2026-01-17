import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ProfileState = 'assessable' | 'building' | 'needs_review' | 'not_found';

export interface ProfileProgress {
  total_events: number;
  dimensions_covered: number;
  domains_covered: number;
  has_description: boolean;
  has_logo: boolean;
  has_website: boolean;
  has_wikidata: boolean;
  enrichment_stage: string | null;
  last_event_at: string | null;
}

export interface MismatchDetail {
  type: string;
  expected: string;
  description_excerpt?: string;
}

export interface ProfileStateData {
  state: ProfileState;
  brand_id: string;
  brand_name: string;
  brand_slug: string | null;
  identity_confidence: 'high' | 'medium' | 'low' | null;
  dimensions_with_evidence: number;
  name_mismatch: boolean;
  mismatch_details: MismatchDetail[];
  progress: ProfileProgress;
  created_at: string | null;
}

export function useProfileState(brandId: string | null | undefined) {
  return useQuery({
    queryKey: ['brand-profile-state', brandId],
    queryFn: async (): Promise<ProfileStateData | null> => {
      if (!brandId) return null;
      
      const { data, error } = await supabase.rpc('get_brand_profile_state', {
        p_brand_id: brandId
      } as any);
      
      if (error) {
        console.error('Error fetching profile state:', error);
        return null;
      }
      
      return data as unknown as ProfileStateData;
    },
    enabled: !!brandId,
    staleTime: 60 * 1000, // Cache for 1 minute
  });
}
