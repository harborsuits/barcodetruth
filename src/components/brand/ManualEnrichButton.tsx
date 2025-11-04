import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Progress } from '@/components/ui/progress';

interface ManualEnrichButtonProps {
  brandId: string;
  brandName: string;
}

export function ManualEnrichButton({ brandId, brandName }: ManualEnrichButtonProps) {
  const [isEnriching, setIsEnriching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'enriching' | 'complete' | 'failed'>('idle');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleEnrich = async () => {
    setIsEnriching(true);
    setStatus('enriching');
    setProgress(0);
    
    try {
      // Step 1: Fetch brand data from Wikidata
      setMessage('Searching Wikidata...');
      setProgress(25);

      const { data: enrichData, error: enrichError } = await supabase.functions.invoke('enrich-brand-wiki', {
        body: { 
          brand_id: brandId,
          mode: 'basic'
        }
      });

      if (enrichError || !enrichData?.success) {
        throw new Error(enrichData?.reason || 'Failed to find brand on Wikidata');
      }

      // Step 2: Logo resolution
      setMessage('Finding brand logo...');
      setProgress(50);

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
        console.warn('[ManualEnrich] Logo fetch failed:', err);
      }

      setProgress(75);
      setMessage('Finalizing...');

      // Step 3: Complete
      setProgress(100);
      setStatus('complete');
      setMessage('Enrichment complete!');

      toast({
        title: "Success",
        description: `${brandName} has been enriched successfully`,
      });

      // Refresh data
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['brand-basic', brandId] });
        queryClient.invalidateQueries({ queryKey: ['brand-company-info', brandId] });
        setIsEnriching(false);
        setStatus('idle');
        setProgress(0);
        setMessage('');
      }, 1500);

    } catch (error: any) {
      console.error('[ManualEnrich] Failed:', error);
      setStatus('failed');
      setMessage(error.message || 'Enrichment failed');
      
      toast({
        title: "Enrichment failed",
        description: error.message || 'Could not enrich this brand',
        variant: "destructive",
      });

      setTimeout(() => {
        setIsEnriching(false);
        setStatus('idle');
        setProgress(0);
        setMessage('');
      }, 3000);
    }
  };

  if (status === 'enriching') {
    return (
      <div className="space-y-2 p-4 border rounded-lg bg-card">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-sm font-medium">Enriching {brandName}...</span>
        </div>
        <p className="text-sm text-muted-foreground">{message}</p>
        <Progress value={progress} className="w-full" />
      </div>
    );
  }

  if (status === 'complete') {
    return (
      <div className="flex items-center gap-2 p-3 border rounded-lg bg-card text-sm">
        <CheckCircle className="h-4 w-4 text-green-500" />
        <span>{message}</span>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="flex items-center gap-2 p-3 border rounded-lg bg-card text-sm text-destructive">
        <XCircle className="h-4 w-4" />
        <span>{message}</span>
      </div>
    );
  }

  return (
    <Button 
      onClick={handleEnrich}
      variant="outline"
      size="sm"
      disabled={isEnriching}
    >
      <RefreshCw className="h-4 w-4 mr-2" />
      Enrich This Brand
    </Button>
  );
}
