import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DisplayProfile {
  brand_id: string;
  display_name: string;
  normalized_name: string;
  logo_url: string | null;
  logo_source: string | null;
  logo_status: string;
  parent_display_name: string | null;
  category_label: string | null;
  summary: string | null;
  score_state: string;
  profile_status: string;
  profile_completeness: number;
  website: string | null;
  last_enriched_at: string;
}

/**
 * Fetches the canonical display profile for a brand.
 * Falls back gracefully if no display profile exists yet.
 */
export function useDisplayProfile(brandId: string | null | undefined) {
  return useQuery({
    queryKey: ["display-profile", brandId],
    enabled: !!brandId,
    staleTime: 5 * 60 * 1000, // 5 min cache
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brand_display_profiles")
        .select("*")
        .eq("brand_id", brandId!)
        .maybeSingle();

      if (error) {
        console.warn("[useDisplayProfile] fetch error:", error.message);
        return null;
      }
      return data as DisplayProfile | null;
    },
  });
}
