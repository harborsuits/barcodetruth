import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type CategoryKey = "labor" | "environment" | "politics" | "social";

/**
 * Fetches category-specific evidence for a brand with strict filtering.
 * 
 * Defense-in-depth approach:
 * 1. Server-side filter: .eq('category', category)
 * 2. Client-side refilter: .filter(event => event.category === category)
 * 3. Cache scoped by brand+category to prevent cross-contamination
 * 
 * @param brandId - Brand UUID
 * @param category - Canonical category: labor | environment | politics | social
 * @param limit - Max events to return (default: 2)
 */
export function useCategoryEvidence(brandId: string, category: CategoryKey, limit: number = 2) {
  return useQuery({
    queryKey: ['category-evidence', brandId, category],
    queryFn: async () => {
      console.debug('[category-evidence]', { brandId, category, limit });
      
      const { data, error } = await supabase
        .from('brand_events')
        .select(`
          event_id,
          title,
          event_date,
          source_url,
          verification,
          category,
          category_code
        `)
        .eq('brand_id', brandId)
        .eq('category', category)
        .eq('is_irrelevant', false)
        .not('category_code', 'like', 'NOISE.%')
        .order('event_date', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      // Defense-in-depth: client-side refilter (temporary hardening)
      const filtered = (data || []).filter(event => event.category === category);
      
      console.debug('[category-evidence] result', { 
        brandId, 
        category, 
        fetched: data?.length || 0,
        filtered: filtered.length 
      });
      
      return filtered;
    },
    enabled: !!brandId && !!category,
    staleTime: 1000 * 60 * 5 // Cache for 5 minutes
  });
}
