import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ReEnrichButtonProps {
  brandId: string;
  brandName: string;
  currentQid: string | null;
}

export function ReEnrichButton({ brandId, brandName, currentQid }: ReEnrichButtonProps) {
  const isAdmin = useIsAdmin();
  const [isEnriching, setIsEnriching] = useState(false);
  const queryClient = useQueryClient();

  // Hide button for non-admin users
  if (!isAdmin) return null;

  async function handleReEnrich() {
    setIsEnriching(true);
    
    try {
      console.log('[ReEnrich] Starting enrichment for brand:', brandId);
      
      // Call enrich-brand-wiki directly with full mode
      const { data: enrichData, error: enrichError } = await supabase.functions.invoke('enrich-brand-wiki', {
        body: {
          brand_id: brandId,
          wikidata_qid: currentQid,
          mode: 'full'
        }
      });

      if (enrichError) {
        console.error('[ReEnrich] Enrichment failed:', enrichError);
        throw enrichError;
      }

      console.log('[ReEnrich] Enrichment complete, triggering score recalculation');

      // Trigger score recalculation
      const { error: scoreError } = await supabase.functions.invoke('recompute-brand-scores', {
        body: { brand_id: brandId }
      });

      if (scoreError) {
        console.warn('[ReEnrich] Score recalculation failed:', scoreError);
      }

      toast.success('Enrichment complete!', {
        description: 'Brand data has been refreshed from Wikidata'
      });

      // Invalidate all brand-related queries to refetch fresh data
      await queryClient.invalidateQueries({ queryKey: ['brand-basic', brandId] });
      await queryClient.invalidateQueries({ queryKey: ['brand', brandId] });
      await queryClient.invalidateQueries({ queryKey: ['ownership', brandId] });
      await queryClient.invalidateQueries({ queryKey: ['key-people', brandId] });
      await queryClient.invalidateQueries({ queryKey: ['shareholders', brandId] });

      // Reload to show updated data
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error: any) {
      console.error('[ReEnrich] Failed:', error);
      toast.error('Re-enrichment failed', {
        description: error.message || 'Failed to enrich brand data'
      });
    } finally {
      setIsEnriching(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Re-enrich
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Re-enrich {brandName}?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              This will clear the current Wikidata information and re-fetch it with improved disambiguation logic.
            </p>
            {currentQid && (
              <p className="text-sm font-mono bg-muted p-2 rounded">
                Current QID: {currentQid}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Use this if the brand information seems incorrect (wrong company, wrong logo, wrong description).
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleReEnrich}
            disabled={isEnriching}
          >
            {isEnriching ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Re-enriching...
              </>
            ) : (
              'Re-enrich'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
