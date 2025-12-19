import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ExternalLink, CheckCircle, XCircle, AlertTriangle, FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface DraftDescriptionCardProps {
  brandId: string;
  brandName: string;
  description: string;
  descriptionSource?: string | null;
  wikidataQid?: string | null;
  isAdmin: boolean;
}

export function DraftDescriptionCard({
  brandId,
  brandName,
  description,
  descriptionSource,
  wikidataQid,
  isAdmin
}: DraftDescriptionCardProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const queryClient = useQueryClient();

  const handleVerify = async () => {
    if (!isAdmin) return;
    setIsVerifying(true);
    try {
      const { error } = await supabase.rpc('admin_verify_brand_identity' as any, {
        p_brand_id: brandId
      });
      
      if (error) throw error;
      
      toast({
        title: 'Identity verified',
        description: `${brandName} has been marked as verified and the description is now public.`
      });
      
      // Refresh brand data
      queryClient.invalidateQueries({ queryKey: ['brand-basic'] });
    } catch (err) {
      console.error('Verify error:', err);
      toast({
        title: 'Verification failed',
        description: err instanceof Error ? err.message : 'Could not verify brand identity',
        variant: 'destructive'
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleReject = async () => {
    if (!isAdmin) return;
    setIsRejecting(true);
    try {
      // Clear bad description and reset to stub for re-enrichment
      const { error } = await supabase
        .from('brands')
        .update({
          description: null,
          description_source: null,
          status: 'stub',
          identity_confidence: 'low',
          identity_notes: `Rejected: bad entity match. Original description: "${description.substring(0, 100)}..."`
        })
        .eq('id', brandId);
      
      if (error) throw error;
      
      toast({
        title: 'Description rejected',
        description: `${brandName} has been reset to stub status for re-enrichment.`
      });
      
      // Refresh brand data
      queryClient.invalidateQueries({ queryKey: ['brand-basic'] });
    } catch (err) {
      console.error('Reject error:', err);
      toast({
        title: 'Rejection failed',
        description: err instanceof Error ? err.message : 'Could not reject description',
        variant: 'destructive'
      });
    } finally {
      setIsRejecting(false);
    }
  };

  // Build source link
  let sourceUrl: string | null = null;
  let sourceLabel = 'Unknown source';
  
  if (descriptionSource === 'wikipedia' || descriptionSource === 'wikidata') {
    sourceLabel = 'Wikipedia';
    sourceUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(brandName)}`;
  } else if (wikidataQid) {
    sourceLabel = 'Wikidata';
    sourceUrl = `https://www.wikidata.org/wiki/${wikidataQid}`;
  }

  return (
    <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400 gap-1">
            <AlertTriangle className="h-3 w-3" />
            Draft — Not shown publicly
          </Badge>
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <FileText className="h-3 w-3" />
              Source: {sourceLabel} <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        
        <div className="text-sm text-foreground leading-relaxed border-l-2 border-amber-400 pl-3 py-1 bg-background/50 rounded-r">
          <p className="italic">"{description}"</p>
        </div>
        
        {isAdmin ? (
          <div className="flex items-center gap-2 pt-2">
            <Button
              size="sm"
              onClick={handleVerify}
              disabled={isVerifying || isRejecting}
              className="gap-1"
            >
              {isVerifying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Verify & Publish
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleReject}
              disabled={isVerifying || isRejecting}
              className="gap-1"
            >
              {isRejecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              Reject & Rebuild
            </Button>
          </div>
        ) : (
          <Alert className="bg-muted/50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              This description is pending verification and not visible to other users.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
