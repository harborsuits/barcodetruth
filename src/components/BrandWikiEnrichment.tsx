import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Auto-enriches brands with Wikipedia descriptions when they're viewed
 * Runs silently in the background - no UI needed
 */
export function BrandWikiEnrichment({ brandId, hasDescription }: { brandId: string, hasDescription: boolean }) {
  useEffect(() => {
    // Only enrich if description is missing
    if (hasDescription) return;
    
    // Trigger Wikipedia enrichment in the background
    const enrichBrand = async () => {
      try {
        console.log('[Wiki] Enriching brand:', brandId);
        const { data, error } = await supabase.functions.invoke('enrich-brand-wiki', {
          body: { brand_id: brandId }
        });
        
        if (error) console.error('[Wiki] Error:', error);
        else console.log('[Wiki] Success:', data);
      } catch (error) {
        // Silent fail - not critical
        console.error('[Wiki] Exception:', error);
      }
    };
    
    // Trigger after a short delay to avoid race conditions
    const timer = setTimeout(enrichBrand, 1000);
    return () => clearTimeout(timer);
  }, [brandId, hasDescription]);
  
  return null; // No UI needed
}
