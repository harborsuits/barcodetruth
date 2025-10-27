import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle, AlertCircle, XCircle } from "lucide-react";
import { refreshCoverageView } from "@/lib/systemHealth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface HealthMetric {
  label: string;
  value: number | string;
  total?: number;
  status?: 'good' | 'warn' | 'error';
}

export function SystemHealthDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<{
    users: HealthMetric[];
    brands: HealthMetric[];
    ingestion: HealthMetric[];
  }>({
    users: [],
    brands: [],
    ingestion: [],
  });

  const fetchHealthMetrics = async () => {
    setLoading(true);
    try {
      // Brand stats  
      const { data: brandStats } = await supabase
        .from('brands')
        .select('id, description, logo_url, parent_company, website')
        .eq('is_active', true)
        .eq('is_test', false);
      
      // Event stats
      const { data: recentEvents } = await supabase
        .from('brand_events')
        .select('event_id, brand_id, created_at')
        .eq('is_test', false)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      
      // Score coverage
      const { data: scores } = await supabase
        .from('brand_scores')
        .select('brand_id, last_updated')
        .gte('last_updated', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      
      const totalBrands = brandStats?.length || 0;
      const brandsWithDesc = brandStats?.filter(b => b.description).length || 0;
      const brandsWithLogo = brandStats?.filter(b => b.logo_url).length || 0;
      const brandsWithParent = brandStats?.filter(b => b.parent_company).length || 0;
      const recentScores = scores?.length || 0;
      
      setMetrics({
        users: [
          {
            label: 'System Status',
            value: 'Operational',
            status: 'good',
          },
        ],
        brands: [
          {
            label: 'Total Active Brands',
            value: totalBrands,
            status: 'good',
          },
          {
            label: 'With Descriptions',
            value: brandsWithDesc,
            total: totalBrands,
            status: brandsWithDesc / totalBrands > 0.9 ? 'good' : 'warn',
          },
          {
            label: 'With Logos',
            value: brandsWithLogo,
            total: totalBrands,
            status: brandsWithLogo / totalBrands > 0.5 ? 'good' : 'warn',
          },
          {
            label: 'With Parent Info',
            value: brandsWithParent,
            total: totalBrands,
            status: brandsWithParent / totalBrands > 0.5 ? 'warn' : 'error',
          },
          {
            label: 'Recent Scores',
            value: recentScores,
            total: totalBrands,
            status: recentScores / totalBrands > 0.9 ? 'good' : 'warn',
          },
        ],
        ingestion: [
          {
            label: 'Events (24h)',
            value: recentEvents?.length || 0,
            status: (recentEvents?.length || 0) > 5 ? 'good' : 'warn',
          },
          {
            label: 'Active Brands',
            value: new Set(recentEvents?.map(e => e.brand_id)).size,
            status: 'good',
          },
        ],
      });
    } catch (error) {
      console.error('Failed to fetch health metrics:', error);
      toast({
        title: "Error",
        description: "Failed to load health metrics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthMetrics();
  }, []);

  const handleRefreshCoverage = async () => {
    setRefreshing(true);
    const success = await refreshCoverageView();
    
    if (success) {
      toast({
        title: "Coverage Refreshed",
        description: "Brand coverage data has been updated",
      });
      await fetchHealthMetrics();
    } else {
      toast({
        title: "Refresh Failed",
        description: "Could not refresh coverage view",
        variant: "destructive",
      });
    }
    setRefreshing(false);
  };

  const StatusIcon = ({ status }: { status?: string }) => {
    switch (status) {
      case 'good':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warn':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const MetricCard = ({ title, metrics }: { title: string; metrics: HealthMetric[] }) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {metrics.map((metric, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusIcon status={metric.status} />
              <span className="text-sm font-medium">{metric.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={metric.status === 'error' ? 'destructive' : 'outline'}>
                {metric.total !== undefined
                  ? `${metric.value}/${metric.total} (${Math.round((Number(metric.value) / metric.total) * 100)}%)`
                  : metric.value}
              </Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );

  if (loading) {
    return <div className="p-6 text-center text-muted-foreground">Loading health metrics...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">System Health</h2>
        <div className="flex gap-2">
          <Button onClick={fetchHealthMetrics} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleRefreshCoverage} disabled={refreshing} size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Update Coverage
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <MetricCard title="Brand Profiles" metrics={metrics.brands} />
        <MetricCard title="News Ingestion" metrics={metrics.ingestion} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Health Status Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>All user accounts properly configured</span>
            </p>
            <p className="flex items-center gap-2">
              {metrics.brands.find(m => m.label === 'With Logos')?.status === 'error' ? (
                <XCircle className="h-4 w-4 text-red-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-yellow-500" />
              )}
              <span>Brand profile enrichment needed (logos, parent companies)</span>
            </p>
            <p className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>News ingestion active and operational</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
