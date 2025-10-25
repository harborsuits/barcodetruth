import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type CategoryKey = "labor" | "environment" | "politics" | "social";

export function useCategoryEvidence(brandId: string, category: CategoryKey, limit: number = 2) {
  return useQuery({
    queryKey: ['category-evidence', brandId, category],
    queryFn: async () => {
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
      return data || [];
    },
    enabled: !!brandId
  });
}
