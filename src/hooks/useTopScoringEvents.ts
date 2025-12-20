import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TopScoringEvent {
  event_id: string;
  title: string;
  category: string;
  category_code: string | null;
  severity: string | null;
  verification: string | null;
  event_date: string;
  source_url: string | null;
  category_impacts: Record<string, number>;
  dominant_category: string;
  dominant_impact: number;
}

/**
 * Fetches top scoring events for a brand (events with actual category impacts)
 * Returns events sorted by absolute impact magnitude
 */
export function useTopScoringEvents(brandId: string | undefined, limit = 5) {
  return useQuery({
    queryKey: ['top-scoring-events', brandId, limit],
    queryFn: async () => {
      if (!brandId) return [];
      
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('brand_events')
        .select(`
          event_id,
          title,
          category,
          category_code,
          severity,
          verification,
          event_date,
          source_url,
          category_impacts
        `)
        .eq('brand_id', brandId)
        .gte('event_date', ninetyDaysAgo)
        .not('category_impacts', 'is', null)
        .neq('is_irrelevant', true)
        .order('event_date', { ascending: false });
      
      if (error) throw error;
      
      // Process and sort by impact magnitude
      const processed: TopScoringEvent[] = (data || [])
        .filter(e => {
          // Filter out events with all-zero impacts
          const impacts = e.category_impacts as Record<string, number> | null;
          if (!impacts) return false;
          return Object.values(impacts).some(v => v !== 0);
        })
        .map(e => {
          const impacts = e.category_impacts as Record<string, number>;
          
          // Find the dominant category (highest absolute impact)
          let dominantCat = 'social';
          let dominantImpact = 0;
          
          for (const [cat, impact] of Object.entries(impacts)) {
            if (Math.abs(impact) > Math.abs(dominantImpact)) {
              dominantCat = cat;
              dominantImpact = impact;
            }
          }
          
          return {
            event_id: e.event_id,
            title: e.title || 'Untitled event',
            category: e.category,
            category_code: e.category_code,
            severity: e.severity,
            verification: e.verification,
            event_date: e.event_date,
            source_url: e.source_url,
            category_impacts: impacts,
            dominant_category: dominantCat,
            dominant_impact: dominantImpact,
          };
        })
        .sort((a, b) => Math.abs(b.dominant_impact) - Math.abs(a.dominant_impact))
        .slice(0, limit);
      
      return processed;
    },
    enabled: !!brandId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
