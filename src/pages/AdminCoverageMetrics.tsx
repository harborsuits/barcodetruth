import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { RefreshCw, BarChart3, AlertTriangle, CheckCircle2, Clock, TrendingDown } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface CoverageMetrics {
  total_active_brands: number;
  checked_24h: number;
  checked_7d: number;
  checked_30d: number;
  never_checked: number;
  stale_14d: number;
  status_breakdown: Record<string, number>;
  top_brands_by_volume: { name: string; event_count: number }[] | null;
  top_parents_by_volume: { parent_name: string; event_count: number }[] | null;
  feed_concentration: { top10_pct: number; total_events_30d: number } | null;
}

export default function AdminCoverageMetrics() {
  const [refreshing, setRefreshing] = useState(false);

  const { data: metrics, isLoading, refetch } = useQuery({
    queryKey: ['coverage-metrics'],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_coverage_metrics');
      if (error) throw error;
      return data as unknown as CoverageMetrics;
    },
  });

  const handleRecompute = async () => {
    setRefreshing(true);
    try {
      const { error } = await (supabase.rpc as any)('recompute_brand_coverage_status');
      if (error) throw error;
      await refetch();
      toast.success('Coverage status recomputed');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
    );
  }

  if (!metrics) return null;

  const statusColors: Record<string, string> = {
    hot: 'bg-red-500/10 text-red-700 border-red-200',
    active: 'bg-green-500/10 text-green-700 border-green-200',
    quiet: 'bg-yellow-500/10 text-yellow-700 border-yellow-200',
    stale: 'bg-orange-500/10 text-orange-700 border-orange-200',
    never_checked: 'bg-muted text-muted-foreground border-border',
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Coverage Metrics</h1>
          <p className="text-muted-foreground">Brand coverage fairness and health</p>
        </div>
        <Button onClick={handleRecompute} disabled={refreshing} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Recompute
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-4 text-center">
          <p className="text-sm text-muted-foreground">Active Brands</p>
          <p className="text-3xl font-bold">{metrics.total_active_brands}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-sm text-muted-foreground">Checked (24h)</p>
          <p className="text-3xl font-bold text-green-600">{metrics.checked_24h}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-sm text-muted-foreground">Checked (7d)</p>
          <p className="text-3xl font-bold">{metrics.checked_7d}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-sm text-muted-foreground">Never Checked</p>
          <p className="text-3xl font-bold text-orange-600">{metrics.never_checked}</p>
        </Card>
      </div>

      {/* Status Breakdown */}
      <Card className="p-6 mb-8">
        <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5" /> Coverage Status Breakdown
        </h2>
        <div className="flex flex-wrap gap-3">
          {Object.entries(metrics.status_breakdown || {}).map(([status, count]) => (
            <div
              key={status}
              className={`px-4 py-2 rounded-lg border ${statusColors[status] || 'bg-muted'}`}
            >
              <p className="text-sm font-medium capitalize">{status.replace('_', ' ')}</p>
              <p className="text-2xl font-bold">{count}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Feed Concentration */}
      {metrics.feed_concentration && (
        <Card className="p-6 mb-8">
          <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" /> Feed Concentration
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Top 10 brands share of feed</p>
              <p className={`text-3xl font-bold ${(metrics.feed_concentration.top10_pct || 0) > 50 ? 'text-red-600' : 'text-green-600'}`}>
                {metrics.feed_concentration.top10_pct || 0}%
              </p>
              <p className="text-xs text-muted-foreground">
                {(metrics.feed_concentration.top10_pct || 0) > 50 ? 'Too concentrated — needs balancing' : 'Healthy distribution'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total events (30d)</p>
              <p className="text-3xl font-bold">{metrics.feed_concentration.total_events_30d || 0}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Top Brands & Parents */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="font-semibold text-lg mb-4">Top Brands by Volume (30d)</h2>
          <div className="space-y-2">
            {(metrics.top_brands_by_volume || []).map((b, i) => (
              <div key={b.name} className="flex justify-between items-center py-1">
                <span className="text-sm">
                  <span className="text-muted-foreground mr-2">{i + 1}.</span>
                  {b.name}
                </span>
                <Badge variant="secondary">{b.event_count}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold text-lg mb-4">Top Parents by Volume (30d)</h2>
          <div className="space-y-2">
            {(metrics.top_parents_by_volume || []).map((p, i) => (
              <div key={p.parent_name} className="flex justify-between items-center py-1">
                <span className="text-sm">
                  <span className="text-muted-foreground mr-2">{i + 1}.</span>
                  {p.parent_name}
                </span>
                <Badge variant="secondary">{p.event_count}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Stale brands */}
      <Card className="p-6 mt-6">
        <h2 className="font-semibold text-lg mb-2 flex items-center gap-2">
          <Clock className="h-5 w-5" /> Stale Brands ({metrics.stale_14d})
        </h2>
        <p className="text-sm text-muted-foreground">
          {metrics.stale_14d} brands haven't been checked in over 14 days.
          Checked in last 30d: {metrics.checked_30d}.
        </p>
      </Card>
    </div>
  );
}
