import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Clock, ExternalLink, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SourceStats {
  source_name: string;
  event_count: number;
  brand_count: number;
  last_insert: string;
}

export default function AdminRSSMonitor() {
  const { toast } = useToast();

  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['rss-monitor-stats'],
    queryFn: async () => {
      // Get stats for RSS sources in last 24h using direct query
      const { data, error } = await supabase
        .from('brand_events')
        .select(`
          event_id,
          created_at,
          brand_id,
          event_sources!inner(source_name)
        `)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .in('event_sources.source_name', ['Google News', 'Reddit', 'SEC EDGAR']);
      
      if (error) throw error;
      
      // Manually aggregate
      const aggregated = (data || []).reduce((acc: Record<string, any>, row: any) => {
        const source = row.event_sources.source_name;
        if (!acc[source]) {
          acc[source] = { 
            source_name: source, 
            event_count: 0, 
            brand_count: new Set<string>(), 
            last_insert: row.created_at 
          };
        }
        acc[source].event_count++;
        acc[source].brand_count.add(row.brand_id);
        if (row.created_at > acc[source].last_insert) {
          acc[source].last_insert = row.created_at;
        }
        return acc;
      }, {});
      
      return Object.values(aggregated).map((s: any) => ({
        source_name: s.source_name,
        event_count: s.event_count,
        brand_count: s.brand_count.size,
        last_insert: s.last_insert
      })) as SourceStats[];
    },
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: recentEvents } = useQuery({
    queryKey: ['rss-recent-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brand_events')
        .select(`
          event_id,
          title,
          category,
          verification,
          relevance_score_raw,
          created_at,
          brand_id,
          brands!inner(name),
          event_sources!inner(source_name, source_url)
        `)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .in('event_sources.source_name', ['Google News', 'Reddit', 'SEC EDGAR'])
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    },
  });

  const triggerManualFetch = async (source: 'google-news' | 'reddit' | 'sec-edgar', brandId: string) => {
    try {
      const functionName = `fetch-${source}-rss`;
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { brand_id: brandId, dryrun: 0 }
      });
      
      if (error) throw error;
      
      toast({
        title: "Manual fetch complete",
        description: `${data.inserted} events inserted, ${data.skipped} skipped`,
      });
      
      refetch();
    } catch (error: any) {
      toast({
        title: "Fetch failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">RSS Ingestion Monitor</h1>
          <p className="text-muted-foreground mt-1">
            Real-time monitoring for Google News, Reddit, and SEC EDGAR feeds
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Source Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {isLoading ? (
          <Card className="p-6">Loading...</Card>
        ) : (
          ['Google News', 'Reddit', 'SEC EDGAR'].map((sourceName) => {
            const sourceStats = stats?.find((s) => s.source_name === sourceName);
            const isActive = sourceStats && new Date(sourceStats.last_insert).getTime() > Date.now() - 2 * 60 * 60 * 1000;
            
            return (
              <Card key={sourceName} className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg">{sourceName}</h3>
                  {isActive ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Events (24h)</span>
                    <span className="font-medium">{sourceStats?.event_count || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Brands</span>
                    <span className="font-medium">{sourceStats?.brand_count || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Last insert</span>
                    <span className="font-medium text-xs">
                      {sourceStats?.last_insert 
                        ? new Date(sourceStats.last_insert).toLocaleTimeString()
                        : 'Never'}
                    </span>
                  </div>
                </div>
                
                {!isActive && sourceStats && (
                  <Badge variant="outline" className="mt-3 w-full justify-center bg-yellow-50 text-yellow-700 border-yellow-300">
                    <Clock className="h-3 w-3 mr-1" />
                    Stale (2h+)
                  </Badge>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* Recent Events Table */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Events (24h)</h2>
        <div className="space-y-3">
          {recentEvents?.map((event: any) => (
            <div
              key={event.event_id}
              className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs">
                    {event.event_sources[0]?.source_name}
                  </Badge>
                  <Badge 
                    variant={event.verification === 'official' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {event.verification}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {event.brands.name}
                  </span>
                </div>
                <p className="text-sm font-medium line-clamp-2">{event.title}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <span>{event.category}</span>
                  <span>•</span>
                  <span>Score: {event.relevance_score_raw}</span>
                  <span>•</span>
                  <span>{new Date(event.created_at).toLocaleString()}</span>
                </div>
              </div>
              {event.event_sources[0]?.source_url && (
                <Button variant="ghost" size="sm" asChild>
                  <a
                    href={event.event_sources[0].source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          ))}
          
          {!recentEvents?.length && (
            <div className="text-center py-8 text-muted-foreground">
              No events found in the last 24 hours
            </div>
          )}
        </div>
      </Card>

      {/* Quick Actions */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Trigger manual fetches for testing (uses Kroger as test brand)
        </p>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => triggerManualFetch('google-news', '5e7f728b-d485-43ce-b82e-ed7c606f01d2')}
          >
            Test Google News
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => triggerManualFetch('reddit', '5e7f728b-d485-43ce-b82e-ed7c606f01d2')}
          >
            Test Reddit
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => triggerManualFetch('sec-edgar', '5e7f728b-d485-43ce-b82e-ed7c606f01d2')}
          >
            Test SEC EDGAR
          </Button>
        </div>
      </Card>
    </div>
  );
}
