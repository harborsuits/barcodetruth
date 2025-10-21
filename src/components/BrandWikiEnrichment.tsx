import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Auto-enriches brands with Wikipedia descriptions when they're viewed
 * Runs silently in the background - no UI needed
 */
export function BrandWikiEnrichment({ 
  brandId, 
  hasDescription, 
  onEnriched 
}: { 
  brandId: string, 
  hasDescription: boolean,
  onEnriched?: () => void 
}) {
  useEffect(() => {
    // Only enrich if description is missing
    if (hasDescription) return;
    
    // Trigger Wikipedia enrichment in the background
    const enrichBrand = async () => {
      try {
        console.log('[Wiki] Enriching brand:', brandId);
        // Note: enrich-brand-wiki expects brand_id as query param, not body
        const { data, error } = await supabase.functions.invoke(`enrich-brand-wiki?brand_id=${brandId}`);
        
        if (error) {
          console.error('[Wiki] Error:', error);
        } else {
          console.log('[Wiki] Success:', data);
          // If enrichment was successful and updated the brand, trigger refetch
          if (data?.updated) {
            onEnriched?.();
          }
        }
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
