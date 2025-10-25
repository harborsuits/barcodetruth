import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle2, Building2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface EnrichmentProgress {
  current: number;
  total: number;
  currentBrand: string;
  skipped: number;
  enriched: number;
  failed: number;
}

export default function AdminBulkEnrichFortune500() {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<EnrichmentProgress>({
    current: 0,
    total: 0,
    currentBrand: '',
    skipped: 0,
    enriched: 0,
    failed: 0
  });

  const enrichFortune500 = async () => {
    setProcessing(true);
    setProgress({ current: 0, total: 0, currentBrand: '', skipped: 0, enriched: 0, failed: 0 });

    try {
      // Get all brands with Wikidata QIDs
      const { data: brands, error: brandsError } = await supabase
        .from('brands')
        .select('id, name, wikidata_qid')
        .not('wikidata_qid', 'is', null)
        .eq('is_active', true)
        .order('name');

      if (brandsError) throw brandsError;

      console.log(`[Bulk Enrich] Found ${brands?.length || 0} brands to process`);
      setProgress(prev => ({ ...prev, total: brands?.length || 0 }));

      for (const brand of brands || []) {
        setProgress(prev => ({ ...prev, current: prev.current + 1, currentBrand: brand.name }));
        console.log(`[Bulk Enrich] Processing: ${brand.name} (${brand.wikidata_qid})`);

        try {
          // Check if already has key people
          const { data: existingPeople } = await supabase
            .from('company_people')
            .select('id')
            .eq('company_id', brand.id)
            .limit(1);

          if (existingPeople && existingPeople.length > 0) {
            console.log(`[Bulk Enrich] ${brand.name} already enriched, skipping`);
            setProgress(prev => ({ ...prev, skipped: prev.skipped + 1 }));
            continue;
          }

          // Trigger full enrichment
          const { error: enrichError } = await supabase.functions.invoke('enrich-brand-wiki', {
            body: {
              brand_id: brand.id,
              wikidata_qid: brand.wikidata_qid,
              mode: 'full'
            }
          });

          if (enrichError) {
            console.error(`[Bulk Enrich] Failed for ${brand.name}:`, enrichError);
            setProgress(prev => ({ ...prev, failed: prev.failed + 1 }));
          } else {
            console.log(`[Bulk Enrich] Success for ${brand.name}`);
            setProgress(prev => ({ ...prev, enriched: prev.enriched + 1 }));
          }

          // Rate limit: 3 seconds between requests
          await new Promise(resolve => setTimeout(resolve, 3000));

        } catch (err) {
          console.error(`[Bulk Enrich] Exception for ${brand.name}:`, err);
          setProgress(prev => ({ ...prev, failed: prev.failed + 1 }));
        }
      }

      console.log('[Bulk Enrich] Complete!', progress);

    } catch (error) {
      console.error('[Bulk Enrich] Fatal error:', error);
    } finally {
      setProcessing(false);
      setProgress(prev => ({ ...prev, currentBrand: '' }));
    }
  };

  const progressPercent = progress.total > 0 
    ? (progress.current / progress.total) * 100 
    : 0;

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Building2 className="h-8 w-8" />
          Bulk Enrich Fortune 500
        </h1>
        <p className="text-muted-foreground">
          Automatically enrich all major brands with corporate structure, key people, and shareholders from Wikidata.
        </p>
      </div>

      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>How This Works</AlertTitle>
        <AlertDescription>
          This tool will process all brands with Wikidata QIDs and:
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Fetch parent companies and subsidiaries</li>
            <li>Extract key people (CEO, Chair, Founders)</li>
            <li>Retrieve top shareholders</li>
            <li>Skip brands that are already enriched</li>
            <li>Apply 3-second rate limit between requests</li>
          </ul>
        </AlertDescription>
      </Alert>

      <Card className="p-6">
        {processing ? (
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Processing: {progress.currentBrand}</span>
              <span className="text-muted-foreground">
                {progress.current} / {progress.total}
              </span>
            </div>
            
            <Progress value={progressPercent} className="h-2" />
            
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="space-y-1">
                <div className="text-2xl font-bold text-green-600">{progress.enriched}</div>
                <div className="text-xs text-muted-foreground">Enriched</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-yellow-600">{progress.skipped}</div>
                <div className="text-xs text-muted-foreground">Skipped</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-red-600">{progress.failed}</div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
            </div>
          </div>
        ) : progress.current > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-semibold">Enrichment Complete!</span>
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="space-y-1">
                <div className="text-2xl font-bold text-green-600">{progress.enriched}</div>
                <div className="text-xs text-muted-foreground">Enriched</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-yellow-600">{progress.skipped}</div>
                <div className="text-xs text-muted-foreground">Skipped</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-red-600">{progress.failed}</div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
            </div>

            <Button onClick={enrichFortune500} className="w-full">
              Run Again
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ready to enrich all brands with missing corporate data. This process may take several hours depending on the number of brands.
            </p>
            <Button 
              onClick={enrichFortune500}
              disabled={processing}
              size="lg"
              className="w-full"
            >
              Start Bulk Enrichment
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}