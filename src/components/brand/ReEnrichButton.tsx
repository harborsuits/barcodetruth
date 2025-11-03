import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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
  const [isEnriching, setIsEnriching] = useState(false);
  const queryClient = useQueryClient();

  async function handleReEnrich() {
    setIsEnriching(true);
    
    try {
      // Clear the wikidata_qid to trigger re-enrichment
      const { error: clearError } = await supabase
        .from('brands')
        .update({ 
          wikidata_qid: null,
          description: null,
          description_source: null,
          logo_url: null,
          logo_attribution: null
        })
        .eq('id', brandId);

      if (clearError) throw clearError;

      toast.success('Re-enrichment started', {
        description: 'Page will refresh automatically when complete'
      });

      // Invalidate to trigger auto-enrichment
      await queryClient.invalidateQueries({ queryKey: ['brand-basic', brandId] });

      // Refresh page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error: any) {
      console.error('[ReEnrich] Failed:', error);
      toast.error('Re-enrichment failed', {
        description: error.message
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
