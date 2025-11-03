import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface EnrichmentProgress {
  status: 'idle' | 'enriching' | 'complete' | 'failed';
  message: string;
  step: number;
  totalSteps: number;
}

export function useAutoEnrichment(brandId: string, brandName: string, needsEnrichment: boolean) {
  const [progress, setProgress] = useState<EnrichmentProgress>({
    status: 'idle',
    message: '',
    step: 0,
    totalSteps: 4
  });
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!needsEnrichment || progress.status !== 'idle') return;

    async function enrichBrand() {
      try {
        setProgress({
          status: 'enriching',
          message: `Finding information about ${brandName}...`,
          step: 1,
          totalSteps: 4
        });

        // Step 1: Search Wikidata for QID
        console.log('[AutoEnrich] Searching Wikidata for:', brandName);
        const wikidataResponse = await fetch(
          `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(brandName)}&language=en&format=json&origin=*`
        );
        const wikidataData = await wikidataResponse.json();
        
        if (!wikidataData.search || wikidataData.search.length === 0) {
          throw new Error('Brand not found in Wikidata');
        }

        const qid = wikidataData.search[0].id;
        console.log('[AutoEnrich] Found QID:', qid);

        // Step 2: Save QID to database
        setProgress({
          status: 'enriching',
          message: 'Saving brand information...',
          step: 2,
          totalSteps: 4
        });

        await supabase
          .from('brands')
          .update({ wikidata_qid: qid })
          .eq('id', brandId);

        // Step 3: Fetch description
        setProgress({
          status: 'enriching',
          message: 'Fetching brand summary...',
          step: 3,
          totalSteps: 4
        });

        try {
          const { data: summaryData } = await supabase.functions.invoke('fetch-brand-summary', {
            body: { brand_id: brandId }
          });
          
          if (summaryData?.description) {
            await supabase
              .from('brands')
              .update({ 
                description: summaryData.description,
                description_source: summaryData.source 
              })
              .eq('id', brandId);
          }
        } catch (err) {
          console.warn('[AutoEnrich] Summary fetch failed:', err);
          // Non-critical, continue
        }

        // Step 4: Fetch logo
        setProgress({
          status: 'enriching',
          message: 'Finding brand logo...',
          step: 4,
          totalSteps: 4
        });

        try {
          const { data: logoData } = await supabase.functions.invoke('resolve-brand-logo', {
            body: { brand_id: brandId }
          });
          
          if (logoData?.logo_url) {
            await supabase
              .from('brands')
              .update({ 
                logo_url: logoData.logo_url,
                logo_attribution: logoData.attribution 
              })
              .eq('id', brandId);
          }
        } catch (err) {
          console.warn('[AutoEnrich] Logo fetch failed:', err);
          // Non-critical, continue
        }

        // Complete!
        setProgress({
          status: 'complete',
          message: `${brandName} has been enriched!`,
          step: 4,
          totalSteps: 4
        });

        // Invalidate queries to refresh page
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['brand-basic', brandId] });
          queryClient.invalidateQueries({ queryKey: ['brand-company-info', brandId] });
        }, 500);

      } catch (error: any) {
        console.error('[AutoEnrich] Failed:', error);
        setProgress({
          status: 'failed',
          message: `Could not enrich ${brandName}: ${error.message}`,
          step: 0,
          totalSteps: 4
        });
      }
    }

    enrichBrand();
  }, [needsEnrichment, brandId, brandName, progress.status, queryClient]);

  return progress;
}
