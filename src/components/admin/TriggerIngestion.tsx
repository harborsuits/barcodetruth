import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Shield, Zap } from 'lucide-react';

interface TriggerIngestionProps {
  brandId: string;
  brandName: string;
}

interface IngestionReport {
  brand_name: string;
  sources: {
    fda: { success: boolean; inserted: number; skipped: number; error?: string };
    osha: { success: boolean; inserted: number; skipped: number; error?: string };
    news: { success: boolean; inserted: number; skipped: number; error?: string };
  };
  post_validation: {
    events_audited: number;
    demoted_entity_mismatch: number;
    demoted_marketing_noise: number;
    demoted_financial_noise: number;
    demoted_zero_impact: number;
    demoted_parent_only: number;
    duplicates_suppressed: number;
    events_after_eligible: number;
  };
  score: {
    before: number | null;
    after: number | null;
    eligible_events: number;
    delta: number;
  };
}

export function TriggerIngestion({ brandId, brandName }: TriggerIngestionProps) {
  const [loading, setLoading] = useState(false);
  const [legacyLoading, setLegacyLoading] = useState(false);
  const [report, setReport] = useState<IngestionReport | null>(null);
  const { toast } = useToast();

  const handleV2Trigger = async () => {
    setLoading(true);
    setReport(null);
    try {
      const { data, error } = await supabase.functions.invoke('targeted-brand-ingestion-v2', {
        body: { brand_id: brandId }
      });

      if (error) throw error;

      setReport(data as IngestionReport);

      const totalInserted = (data?.sources?.fda?.inserted || 0) + 
                           (data?.sources?.osha?.inserted || 0) + 
                           (data?.sources?.news?.inserted || 0);
      const totalDemoted = (data?.post_validation?.demoted_entity_mismatch || 0) +
                          (data?.post_validation?.demoted_marketing_noise || 0) +
                          (data?.post_validation?.demoted_financial_noise || 0) +
                          (data?.post_validation?.demoted_zero_impact || 0) +
                          (data?.post_validation?.demoted_parent_only || 0) +
                          (data?.post_validation?.duplicates_suppressed || 0);

      toast({
        title: 'V2 Ingestion complete',
        description: `+${totalInserted} new events, ${totalDemoted} filtered out, ${data?.score?.eligible_events || 0} eligible. Score: ${data?.score?.before ?? '?'} → ${data?.score?.after ?? '?'}`,
      });

    } catch (error: any) {
      console.error('V2 Ingestion error:', error);
      toast({
        title: 'Ingestion failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLegacyTrigger = async () => {
    setLegacyLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('trigger-brand-ingestion', {
        body: { brand_id: brandId }
      });

      if (error) throw error;

      const results = data?.results || {};
      const successCount = Object.values(results).filter((r: any) => r.success).length;
      const totalCount = Object.keys(results).length;

      toast({
        title: 'Legacy ingestion triggered',
        description: `${successCount}/${totalCount} sources succeeded for ${brandName}.`,
      });

      setTimeout(() => window.location.reload(), 2000);
    } catch (error: any) {
      toast({ title: 'Ingestion failed', description: error.message, variant: 'destructive' });
    } finally {
      setLegacyLoading(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Brand Ingestion</h3>
        <p className="text-sm text-muted-foreground">
          Fetch and validate evidence for {brandName} from FDA, OSHA, and news sources.
        </p>

        <div className="flex gap-2">
          <Button 
            onClick={handleV2Trigger} 
            disabled={loading || legacyLoading}
            size="sm"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Shield className="mr-1 h-4 w-4" />
            {loading ? 'Running V2...' : 'Smart Ingest (V2)'}
          </Button>
          <Button 
            onClick={handleLegacyTrigger} 
            disabled={loading || legacyLoading}
            size="sm"
            variant="outline"
          >
            {legacyLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Zap className="mr-1 h-4 w-4" />
            Legacy
          </Button>
        </div>

        {report && (
          <div className="mt-3 space-y-2 text-xs font-mono bg-muted/50 rounded p-3">
            <div className="font-semibold text-sm text-foreground">Ingestion Report: {report.brand_name}</div>
            
            <div className="text-muted-foreground">— Sources —</div>
            <div>FDA: {report.sources.fda.success ? `+${report.sources.fda.inserted}` : `❌ ${report.sources.fda.error?.substring(0, 60)}`}</div>
            <div>OSHA: {report.sources.osha.success ? `+${report.sources.osha.inserted}` : `❌ ${report.sources.osha.error?.substring(0, 60)}`}</div>
            <div>News: {report.sources.news.success ? `+${report.sources.news.inserted}` : `❌ ${report.sources.news.error?.substring(0, 60)}`}</div>
            
            <div className="text-muted-foreground mt-1">— Post-Validation ({report.post_validation.events_audited} audited) —</div>
            {report.post_validation.demoted_entity_mismatch > 0 && (
              <div className="text-destructive">⛔ {report.post_validation.demoted_entity_mismatch} entity mismatches removed</div>
            )}
            {report.post_validation.demoted_marketing_noise > 0 && (
              <div className="text-destructive">📢 {report.post_validation.demoted_marketing_noise} marketing noise removed</div>
            )}
            {report.post_validation.demoted_financial_noise > 0 && (
              <div className="text-destructive">💰 {report.post_validation.demoted_financial_noise} financial noise removed</div>
            )}
            {report.post_validation.demoted_zero_impact > 0 && (
              <div className="text-destructive">⚪ {report.post_validation.demoted_zero_impact} zero-impact events removed</div>
            )}
            {report.post_validation.demoted_parent_only > 0 && (
              <div className="text-destructive">🏢 {report.post_validation.demoted_parent_only} parent-only references removed</div>
            )}
            {report.post_validation.duplicates_suppressed > 0 && (
              <div className="text-destructive">♊ {report.post_validation.duplicates_suppressed} duplicates suppressed</div>
            )}
            
            <div className="text-muted-foreground mt-1">— Score —</div>
            <div className="font-semibold">
              {report.score.before ?? '—'} → {report.score.after ?? '—'} 
              {report.score.delta !== 0 && (
                <span className={report.score.delta > 0 ? 'text-green-600' : 'text-destructive'}>
                  {' '}({report.score.delta > 0 ? '+' : ''}{report.score.delta})
                </span>
              )}
            </div>
            <div>{report.score.eligible_events} eligible events</div>
          </div>
        )}
      </div>
    </Card>
  );
}
