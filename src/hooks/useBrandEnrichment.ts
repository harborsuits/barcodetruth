import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useBrandEnrichment() {
  const { toast } = useToast();

  const fetchSummary = async (brandId: string) => {
    try {
      console.log('[useBrandEnrichment] Fetching summary for brand:', brandId);
      const { data, error } = await supabase.functions.invoke('fetch-brand-summary', {
        body: { brand_id: brandId }
      });
      
      console.log('[useBrandEnrichment] Summary response:', data, error);
      if (error) throw error;
      
      if (data?.ok) {
        toast({
          title: 'Summary updated',
          description: 'Brand description has been fetched from Wikipedia.',
        });
        return true;
      } else {
        const reason = data?.reason || 'unknown';
        if (reason === 'no_wikidata') {
          toast({
            title: 'No Wikipedia data',
            description: 'This brand doesn\'t have a Wikidata ID yet.',
            variant: 'destructive'
          });
        } else if (reason === 'manual_override') {
          toast({
            title: 'Manual override',
            description: 'This brand has a manually entered description.',
          });
        }
        return false;
      }
    } catch (error: any) {
      console.error('Error fetching summary:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch brand summary.',
        variant: 'destructive'
      });
      return false;
    }
  };

  const fetchLogo = async (brandId: string) => {
    try {
      console.log('[useBrandEnrichment] Fetching logo for brand:', brandId);
      const { data, error } = await supabase.functions.invoke('resolve-brand-logo', {
        body: { brand_id: brandId }
      });
      
      console.log('[useBrandEnrichment] Logo response:', data, error);
      if (error) throw error;
      
      if (data?.ok) {
        toast({
          title: 'Logo updated',
          description: `Brand logo has been fetched from ${data.attribution}.`,
        });
        return true;
      } else {
        const reason = data?.reason || 'unknown';
        if (reason === 'no_logo_found') {
          toast({
            title: 'No logo found',
            description: 'Could not find a logo for this brand.',
            variant: 'destructive'
          });
        } else if (reason === 'manual_override') {
          toast({
            title: 'Manual override',
            description: 'This brand has a manually uploaded logo.',
          });
        }
        return false;
      }
    } catch (error: any) {
      console.error('Error fetching logo:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch brand logo.',
        variant: 'destructive'
      });
      return false;
    }
  };

  const enrichBrand = async (brandId: string) => {
    try {
      console.log('[useBrandEnrichment] Enriching brand:', brandId);
      const { data, error } = await supabase.functions.invoke('enrich-brand-wiki', {
        body: { brand_id: brandId }
      });
      
      console.log('[useBrandEnrichment] Enrich response:', data, error);
      if (error) throw error;
      
      if (data?.ok) {
        toast({
          title: 'Brand enriched',
          description: 'Brand data updated from Wikidata.',
        });
        return true;
      } else {
        const reason = data?.reason || 'unknown';
        toast({
          title: 'Enrichment failed',
          description: `Could not enrich brand: ${reason}`,
          variant: 'destructive'
        });
        return false;
      }
    } catch (error: any) {
      console.error('Error enriching brand:', error);
      toast({
        title: 'Error',
        description: 'Failed to enrich brand.',
        variant: 'destructive'
      });
      return false;
    }
  };

  return { fetchSummary, fetchLogo, enrichBrand };
}