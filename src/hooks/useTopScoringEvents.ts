import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TopScoringEvent {
  event_id: string;
  title: string;
  category: string;
  category_code: string | null;
  severity: string | null;
  verification_label: string; // derived from verification_factor
  event_date: string;
  created_at: string;
  source_url: string | null;
  category_impacts: Record<string, number>;
  dominant_category: string;
  dominant_impact: number;
  effective_impact: number; // weighted by verification_factor, credibility, recency
}

/**
 * Derive a verification label from verification_factor
 */
function getVerificationLabel(factor: number | null): string {
  if (factor === null || factor === undefined) return 'unverified';
  if (factor >= 0.9) return 'verified';
  if (factor >= 0.7) return 'corroborated';
  return 'other coverage';
}

/**
 * Calculate recency decay factor (events older than 90 days get reduced weight)
 */
function getRecencyDecay(dateStr: string): number {
  const eventDate = new Date(dateStr);
  const now = new Date();
  const daysDiff = (now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24);
  
  if (daysDiff <= 7) return 1.0;
  if (daysDiff <= 30) return 0.9;
  if (daysDiff <= 60) return 0.7;
  return 0.5;
}

/**
 * Fetches top scoring events for a brand (events with actual category impacts)
 * Returns events sorted by effective impact (weighted by verification, credibility, recency)
 */
export function useTopScoringEvents(brandId: string | undefined, limit = 5) {
  return useQuery({
    queryKey: ['top-scoring-events', brandId, limit],
    queryFn: async () => {
      if (!brandId) return [];
      
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      
      // Use created_at for filtering (always present), event_date for display
      const { data, error } = await supabase
        .from('brand_events')
        .select(`
          event_id,
          title,
          category,
          category_code,
          severity,
          verification_factor,
          credibility,
          event_date,
          created_at,
          source_url,
          category_impacts,
          is_irrelevant
        `)
        .eq('brand_id', brandId)
        .gte('created_at', ninetyDaysAgo)
        .not('category_impacts', 'is', null)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Process and sort by effective impact magnitude
      const processed: TopScoringEvent[] = (data || [])
        .filter(e => {
          // Explicitly filter out irrelevant events (handle null as false)
          if (e.is_irrelevant === true) return false;
          
          // Filter out events with all-zero impacts
          const impacts = e.category_impacts as Record<string, number> | null;
          if (!impacts) return false;
          return Object.values(impacts).some(v => v !== 0);
        })
        .map(e => {
          const impacts = e.category_impacts as Record<string, number>;
          const verificationFactor = (e.verification_factor as number) ?? 0.5;
          const credibility = (e.credibility as number) ?? 0.5;
          const displayDate = e.event_date || e.created_at;
          const recencyDecay = getRecencyDecay(displayDate);
          
          // Find the dominant category (highest absolute impact)
          let dominantCat = 'social';
          let dominantImpact = 0;
          
          for (const [cat, impact] of Object.entries(impacts)) {
            if (Math.abs(impact) > Math.abs(dominantImpact)) {
              dominantCat = cat;
              dominantImpact = impact;
            }
          }
          
          // Compute effective impact (matches scoring physics)
          const effectiveImpact = dominantImpact * verificationFactor * credibility * recencyDecay;
          
          return {
            event_id: e.event_id,
            title: e.title || 'Untitled event',
            category: e.category,
            category_code: e.category_code,
            severity: e.severity as string | null,
            verification_label: getVerificationLabel(verificationFactor),
            event_date: displayDate,
            created_at: e.created_at,
            source_url: e.source_url,
            category_impacts: impacts,
            dominant_category: dominantCat,
            dominant_impact: dominantImpact,
            effective_impact: effectiveImpact,
          };
        })
        .sort((a, b) => Math.abs(b.effective_impact) - Math.abs(a.effective_impact))
        .slice(0, limit);
      
      return processed;
    },
    enabled: !!brandId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
