import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useBrandEnrichment() {
  const { toast } = useToast();

  const fetchSummary = async (brandId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('fetch-brand-summary', {
        body: { brand_id: brandId }
      });
      
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
      const { data, error } = await supabase.functions.invoke('resolve-brand-logo', {
        body: { brand_id: brandId }
      });
      
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

  return { fetchSummary, fetchLogo };
}