import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircle2, XCircle, Clock, RefreshCw, Users, Building2, DollarSign, FileText } from 'lucide-react';

export default function AdminEnrichmentMonitor() {
  const [triggeringBatch, setTriggeringBatch] = useState(false);

  const { data: runs, isLoading, refetch } = useQuery({
    queryKey: ['enrichment-runs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enrichment_runs')
        .select('*')
        .order('finished_at', { ascending: false, nullsFirst: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000 // Refresh every 10s
  });

  const { data: stats } = useQuery({
    queryKey: ['enrichment-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enrichment_runs')
        .select('task, status, rows_written')
        .gte('finished_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      
      if (error) {
        console.error('Stats error:', error);
        return null;
      }
      
      return {
        total_runs_24h: data?.length || 0,
        wiki_runs_24h: data?.filter(r => r.task === 'wiki').length || 0,
        ownership_runs_24h: data?.filter(r => r.task === 'ownership').length || 0,
        people_runs_24h: data?.filter(r => r.task === 'key_people').length || 0,
        success_rate: data?.length ? (data.filter(r => r.status === 'success').length / data.length * 100).toFixed(1) : '0'
      };
    }
  });

  const handleBatchEnrich = async () => {
    setTriggeringBatch(true);
    try {
      await supabase.functions.invoke('bulk-enrich-brands');
      setTimeout(() => refetch(), 2000);
    } catch (error) {
      console.error('Batch enrich error:', error);
    } finally {
      setTriggeringBatch(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Enrichment Monitor</h1>
            <p className="text-muted-foreground">
              Track Wikipedia & Wikidata enrichment runs
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => refetch()} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button 
              onClick={handleBatchEnrich} 
              disabled={triggeringBatch}
              size="sm"
            >
              {triggeringBatch ? 'Processing...' : 'Run Batch Enrichment'}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Runs (24h)</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {stats ? (
                <div className="text-2xl font-bold">{stats.total_runs_24h || 0}</div>
              ) : (
                <Skeleton className="h-8 w-16" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Wiki Enrichments</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {stats ? (
                <div className="text-2xl font-bold">{stats.wiki_runs_24h || 0}</div>
              ) : (
                <Skeleton className="h-8 w-16" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ownership Runs</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {stats ? (
                <div className="text-2xl font-bold">{stats.ownership_runs_24h || 0}</div>
              ) : (
                <Skeleton className="h-8 w-16" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {stats ? (
                <div className="text-2xl font-bold">{stats.success_rate}%</div>
              ) : (
                <Skeleton className="h-8 w-16" />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Runs */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Enrichment Runs</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : !runs || runs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No enrichment runs yet
              </div>
            ) : (
              <div className="space-y-3">
                {runs.map((run: any) => (
                  <div 
                    key={run.id} 
                    className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          {run.brand_id?.slice(0, 8) || 'N/A'}
                        </span>
                        <Badge variant={
                          run.status === 'success' ? 'default' : 
                          run.status === 'partial' ? 'secondary' : 
                          'destructive'
                        } className="text-xs">
                          {run.task}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {run.finished_at ? formatDistanceToNow(new Date(run.finished_at), { addSuffix: true }) : 'Running...'}
                        </span>
                        {run.duration_ms && (
                          <Badge variant="outline" className="text-xs">
                            {run.duration_ms}ms
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-xs">
                          Status: {run.status}
                        </Badge>
                        {run.rows_written > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {run.rows_written} rows written
                          </Badge>
                        )}
                      </div>

                      {run.error && (
                        <div className="flex items-start gap-2 mt-2 text-xs text-destructive">
                          <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                          <span>{run.error}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-shrink-0">
                      {run.status === 'failed' ? (
                        <XCircle className="h-5 w-5 text-destructive" />
                      ) : run.status === 'partial' ? (
                        <Clock className="h-5 w-5 text-yellow-600" />
                      ) : (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
