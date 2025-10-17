import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function AdminNewsTest() {
  const { toast } = useToast();
  const [brandId, setBrandId] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const testIngestion = async () => {
    if (!brandId.trim()) {
      toast({ title: 'Error', description: 'Enter a brand ID', variant: 'destructive' });
      return;
    }

    setLoading(true);
    setResults(null);

    try {
      // 1. Check if baseline exists
      console.log('[Test] Checking baseline for brand:', brandId);
      const { data: baseline } = await supabase
        .from('brand_baselines')
        .select('baseline_complete, articles_analyzed, baseline_labor')
        .eq('brand_id', brandId)
        .maybeSingle();

      if (!baseline?.baseline_complete) {
        toast({
          title: 'Warning',
          description: 'No baseline found - running baseline scan first...',
          duration: 5000
        });

        // Run baseline scan
        console.log('[Test] Running baseline scanner...');
        const { data: baselineData, error: baselineError } = await supabase.functions.invoke(
          'historical-baseline-scanner',
          { body: { brand_id: brandId } }
        );

        if (baselineError) throw baselineError;
        console.log('[Test] Baseline scan result:', baselineData);
      } else {
        console.log('[Test] Baseline exists:', baseline);
      }

      // 2. Call orchestrator
      console.log('[Test] Calling orchestrator for brand:', brandId);
      const { data: ingestData, error: ingestError } = await supabase.functions.invoke(
        'unified-news-orchestrator',
        {
          body: { brand_id: brandId, max: 10 }
        }
      );

      if (ingestError) throw ingestError;

      console.log('[Test] Ingestion result:', ingestData);

      // 3. Call scorer
      console.log('[Test] Calling scorer for brand:', brandId);
      const { data: scoreData, error: scoreError } = await supabase.functions.invoke(
        'calculate-brand-score',
        {
          body: { brand_id: brandId, persist: true }
        }
      );

      if (scoreError) throw scoreError;

      console.log('[Test] Scoring result:', scoreData);

      // 4. Fetch actual data from DB
      const { data: events } = await supabase
        .from('brand_events')
        .select('event_id, title, event_date, category, verification')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .limit(10);

      const { data: sources } = await supabase
        .from('event_sources')
        .select('id, source_name, canonical_url, event_id')
        .order('created_at', { ascending: false })
        .limit(10);

      const { data: score } = await supabase
        .from('brand_scores')
        .select('*')
        .eq('brand_id', brandId)
        .order('last_updated', { ascending: false })
        .limit(1)
        .single();

      const { data: baselineData } = await supabase
        .from('brand_baselines')
        .select('*')
        .eq('brand_id', brandId)
        .maybeSingle();

      setResults({
        ingest: ingestData,
        score: scoreData,
        eventsCount: events?.length || 0,
        sourcesCount: sources?.length || 0,
        events: events || [],
        sources: sources || [],
        scoreRow: score,
        baseline: baselineData
      });

      toast({
        title: 'Success',
        description: `Fetched ${ingestData?.totalInserted || 0} articles, ${events?.length || 0} events in DB`
      });
    } catch (err: any) {
      console.error('[Test] Error:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to test ingestion',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">News Ingestion Test</h1>

      <Card className="p-6 mb-6">
        <div className="flex gap-4">
          <Input
            placeholder="Brand ID (UUID)"
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            className="flex-1"
          />
          <Button onClick={testIngestion} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Test Ingestion
          </Button>
        </div>
      </Card>

      {results && (
        <div className="space-y-4">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Ingestion Result</h2>
            <pre className="bg-muted p-4 rounded text-sm overflow-auto">
              {JSON.stringify(results.ingest, null, 2)}
            </pre>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Score Calculation</h2>
            <pre className="bg-muted p-4 rounded text-sm overflow-auto">
              {JSON.stringify(results.score, null, 2)}
            </pre>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">
              Events in DB ({results.eventsCount})
            </h2>
            {results.events.length === 0 ? (
              <p className="text-muted-foreground">No events found</p>
            ) : (
              <div className="space-y-2">
                {results.events.map((e: any) => (
                  <div key={e.event_id} className="border-l-4 border-primary pl-4 py-2">
                    <div className="font-medium">{e.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {e.category} • {e.verification} • {e.event_date}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">
              Sources in DB ({results.sourcesCount})
            </h2>
            {results.sources.length === 0 ? (
              <p className="text-muted-foreground">No sources found</p>
            ) : (
              <div className="space-y-2">
                {results.sources.map((s: any) => (
                  <div key={s.id} className="border-l-4 border-secondary pl-4 py-2">
                    <div className="font-medium">{s.source_name}</div>
                    <div className="text-sm text-muted-foreground break-all">
                      {s.canonical_url}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Event ID: {s.event_id || 'NOT LINKED'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {results.scoreRow && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Current Score</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Labor</div>
                  <div className="text-2xl font-bold">{results.scoreRow.score_labor}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Environment</div>
                  <div className="text-2xl font-bold">{results.scoreRow.score_environment}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Politics</div>
                  <div className="text-2xl font-bold">{results.scoreRow.score_politics}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Social</div>
                  <div className="text-2xl font-bold">{results.scoreRow.score_social}</div>
                </div>
              </div>
              <div className="mt-4 text-sm text-muted-foreground">
                Updated: {new Date(results.scoreRow.last_updated).toLocaleString()}
              </div>
            </Card>
          )}

          {results.baseline && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Baseline Metrics (90-Day)</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Articles/Week:</span>
                  <span className="font-mono">{Number(results.baseline.articles_per_week).toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Articles Analyzed:</span>
                  <span className="font-mono">{results.baseline.articles_analyzed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Baseline Labor:</span>
                  <span className="font-mono">{results.baseline.baseline_labor}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Baseline Environment:</span>
                  <span className="font-mono">{results.baseline.baseline_environment}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Baseline Politics:</span>
                  <span className="font-mono">{results.baseline.baseline_politics}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Baseline Social:</span>
                  <span className="font-mono">{results.baseline.baseline_social}</span>
                </div>
              </div>
              <div className="mt-4 text-sm text-muted-foreground">
                Completed: {new Date(results.baseline.scan_completed_at).toLocaleString()}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
