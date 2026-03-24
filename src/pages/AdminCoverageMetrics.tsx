import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { RefreshCw, BarChart3, AlertTriangle, Clock, TrendingDown, TrendingUp, ArrowDown, ArrowUp, Minus } from 'lucide-react';
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

interface Snapshot {
  snapshot_date: string;
  never_checked_count: number;
  quiet_count: number;
  stale_count: number;
  active_count: number;
  hot_count: number;
  total_products: number;
  brand_linked_pct: number;
  brands_checked_24h: number;
}

function DeltaChip({ current, previous, label, invertColor = false }: { current: number; previous: number | null; label: string; invertColor?: boolean }) {
  if (previous === null) return null;
  const delta = current - previous;
  if (delta === 0) return <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Minus className="h-3 w-3" /> 0</span>;
  const isPositive = delta > 0;
  const isGood = invertColor ? !isPositive : isPositive;
  return (
    <span className={`text-xs font-medium flex items-center gap-0.5 ${isGood ? 'text-green-600' : 'text-red-600'}`}>
      {isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {isPositive ? '+' : ''}{delta.toFixed(label === 'brand_linked_pct' ? 2 : 0)}
    </span>
  );
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

  const { data: trendData } = useQuery({
    queryKey: ['coverage-trend'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coverage_daily_snapshots' as any)
        .select('snapshot_date, never_checked_count, quiet_count, stale_count, active_count, hot_count, total_products, brand_linked_pct, brands_checked_24h')
        .order('snapshot_date', { ascending: true })
        .limit(90);
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        date: new Date(d.snapshot_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      })) as (Snapshot & { date: string })[];
    },
  });

  // Get latest two snapshots for deltas
  const latest = trendData && trendData.length > 0 ? trendData[trendData.length - 1] : null;
  const previous = trendData && trendData.length > 1 ? trendData[trendData.length - 2] : null;

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

  const handleRecordSnapshot = async () => {
    try {
      const { error } = await (supabase.rpc as any)('record_coverage_snapshot');
      if (error) throw error;
      toast.success('Snapshot recorded');
    } catch (e: any) {
      toast.error(e.message);
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
        <div className="flex gap-2">
          <Button onClick={handleRecordSnapshot} variant="outline" size="sm">
            📸 Snapshot
          </Button>
          <Button onClick={handleRecompute} disabled={refreshing} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Recompute
          </Button>
        </div>
      </div>

      {/* KPI Cards with Deltas */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Never Checked</p>
          <p className="text-2xl font-bold text-orange-600">{latest?.never_checked_count ?? metrics.never_checked}</p>
          <DeltaChip current={latest?.never_checked_count ?? 0} previous={previous?.never_checked_count ?? null} label="never_checked" invertColor />
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Quiet</p>
          <p className="text-2xl font-bold">{latest?.quiet_count ?? 0}</p>
          <DeltaChip current={latest?.quiet_count ?? 0} previous={previous?.quiet_count ?? null} label="quiet" />
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Stale</p>
          <p className="text-2xl font-bold text-orange-500">{latest?.stale_count ?? metrics.stale_14d}</p>
          <DeltaChip current={latest?.stale_count ?? 0} previous={previous?.stale_count ?? null} label="stale" invertColor />
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Checked (24h)</p>
          <p className="text-2xl font-bold text-green-600">{latest?.brands_checked_24h ?? metrics.checked_24h}</p>
          <DeltaChip current={latest?.brands_checked_24h ?? 0} previous={previous?.brands_checked_24h ?? null} label="checked_24h" />
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Total Products</p>
          <p className="text-2xl font-bold">{latest?.total_products ?? 0}</p>
          <DeltaChip current={latest?.total_products ?? 0} previous={previous?.total_products ?? null} label="total_products" />
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Brand Linked %</p>
          <p className="text-2xl font-bold">{(latest?.brand_linked_pct ?? 0).toFixed(1)}%</p>
          <DeltaChip current={latest?.brand_linked_pct ?? 0} previous={previous?.brand_linked_pct ?? null} label="brand_linked_pct" />
        </Card>
      </div>

      {/* Coverage Trend Chart */}
      {trendData && trendData.length > 0 && (
        <Card className="p-6 mb-8">
          <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <TrendingDown className="h-5 w-5" /> Backlog Trend (Daily)
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Tracking whether the never_checked backlog is declining over time.
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="never_checked_count" name="Never Checked" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="quiet_count" name="Quiet" stroke="hsl(var(--muted-foreground))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="active_count" name="Active" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="brands_checked_24h" name="Checked (24h)" stroke="hsl(var(--accent-foreground))" strokeWidth={1} strokeDasharray="5 5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Status Breakdown */}
      <Card className="p-6 mb-8">
        <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5" /> Coverage Status Breakdown
        </h2>
        <div className="flex flex-wrap gap-3">
          {Object.entries(metrics.status_breakdown || {}).map(([status, count]) => (
            <div key={status} className={`px-4 py-2 rounded-lg border ${statusColors[status] || 'bg-muted'}`}>
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
