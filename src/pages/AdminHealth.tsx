import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Activity, AlertTriangle, Clock, XCircle, CheckCircle, ArrowLeft, RefreshCw, Loader2 } from "lucide-react";
import { Helmet } from "react-helmet";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface JobRun {
  id: string;
  job_name: string;
  mode: string;
  started_at: string;
  finished_at?: string;
  duration_ms?: number;
  status: string;
  success_count: number;
  error_count: number;
  anomalies_count: number;
}

interface Anomaly {
  id: string;
  brand_id: string;
  category: string;
  delta: number;
  created_at: string;
  brands?: { name: string };
}

interface HealthData {
  runs: JobRun[];
  anomalies: Anomaly[];
  totals: {
    last24h_runs: number;
    last24h_anomalies: number;
    total_errors_24h: number;
  };
}

interface QACheck {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  message: string;
}

interface QAResult {
  fn: string;
  brands_tested: number;
  mixed_found: number;
  caps_ok: boolean;
  duration_ms: number;
  checks: QACheck[];
}

interface HealthMetrics {
  evidence_recent: boolean;
  match_rate_ok: boolean;
  scores_fresh: boolean;
  homepage_ok: boolean;
  details: {
    rss_items_2h: number;
    rss_matched_2h: number;
    match_rate_pct: number;
    scores_updated_24h: number;
    homepage_pending: number;
    products_with_brands: number;
    total_products: number;
  };
}

interface QueueHealth {
  ready_to_process: number;
  total_pending: number;
  currently_processing: number;
  failed_last_hour: number;
  oldest_pending: string | null;
}

interface IngestionHealth {
  stub_count: number;
  building_count: number;
  failed_count: number;
  ready_count: number;
  ready_to_enrich: number;
  stuck_building: Array<{
    id: string;
    name: string;
    updated_at: string;
    enrichment_stage: string | null;
    enrichment_error: string | null;
  }>;
  failed_brands: Array<{
    id: string;
    name: string;
    enrichment_attempts: number;
    enrichment_error: string | null;
    next_enrichment_at: string | null;
  }>;
}

export default function AdminHealth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [data, setData] = useState<HealthData | null>(null);
  const [qaResult, setQaResult] = useState<QAResult | null>(null);
  const [showQaModal, setShowQaModal] = useState(false);
  const [healthMetrics, setHealthMetrics] = useState<HealthMetrics | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [queueHealth, setQueueHealth] = useState<QueueHealth | null>(null);
  const [ingestionHealth, setIngestionHealth] = useState<IngestionHealth | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  useEffect(() => {
    checkAdminAndFetch();
  }, []);

  async function checkAdminAndFetch() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: role } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    setIsAdmin(!!role);
    if (role) await fetchHealth();
  }

  async function fetchHealth() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-health", {
        body: {},
      });

      if (error) throw error;
      setData(data);

      // Fetch queue health using raw query (view not in types yet)
      const { data: queueRows, error: queueError } = await supabase
        .from('queue_health' as any)
        .select('*')
        .limit(1);
      
      if (!queueError && queueRows && queueRows.length > 0) {
        setQueueHealth(queueRows[0] as unknown as QueueHealth);
      }

      // Fetch ingestion health (brand status counts + stuck/failed brands)
      await fetchIngestionHealth();
    } catch (e: any) {
      console.error("Health fetch error:", e);
      toast.error(e.message || "Failed to load health data");
    } finally {
      setLoading(false);
    }
  }

  async function fetchIngestionHealth() {
    try {
      // Get status counts
      const { data: statusCounts } = await supabase
        .from('brands')
        .select('status')
        .in('status', ['stub', 'building', 'failed', 'ready']);
      
      const counts = {
        stub: 0,
        building: 0,
        failed: 0,
        ready: 0,
      };
      statusCounts?.forEach((b: any) => {
        if (b.status in counts) counts[b.status as keyof typeof counts]++;
      });

      // Get ready to enrich count
      const { count: readyToEnrich } = await supabase
        .from('brands')
        .select('*', { count: 'exact', head: true })
        .in('status', ['stub', 'failed'])
        .lt('enrichment_attempts', 5)
        .lte('next_enrichment_at', new Date().toISOString());

      // Get stuck building (building for > 15 minutes)
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data: stuckBuilding } = await supabase
        .from('brands')
        .select('id, name, updated_at, enrichment_stage, enrichment_error')
        .eq('status', 'building')
        .lt('updated_at', fifteenMinsAgo)
        .limit(20);

      // Get failed brands
      const { data: failedBrands } = await supabase
        .from('brands')
        .select('id, name, enrichment_attempts, enrichment_error, next_enrichment_at')
        .eq('status', 'failed')
        .order('updated_at', { ascending: false })
        .limit(20);

      setIngestionHealth({
        stub_count: counts.stub,
        building_count: counts.building,
        failed_count: counts.failed,
        ready_count: counts.ready,
        ready_to_enrich: readyToEnrich || 0,
        stuck_building: stuckBuilding || [],
        failed_brands: failedBrands || [],
      });
    } catch (e) {
      console.error("Failed to fetch ingestion health:", e);
    }
  }

  async function retryBrand(brandId: string) {
    setRetrying(brandId);
    try {
      const { error } = await supabase.functions.invoke("admin-brand-retry", {
        body: { action: "retry_now", brand_ids: [brandId] },
      });
      if (error) throw error;
      toast.success("Brand queued for retry");
      await fetchIngestionHealth();
    } catch (e: any) {
      toast.error(e.message || "Failed to retry brand");
    } finally {
      setRetrying(null);
    }
  }

  async function retryAllStuck() {
    if (!ingestionHealth?.stuck_building.length) return;
    const ids = ingestionHealth.stuck_building.map(b => b.id);
    setRetrying("all-stuck");
    try {
      const { error } = await supabase.functions.invoke("admin-brand-retry", {
        body: { action: "reset_to_stub", brand_ids: ids },
      });
      if (error) throw error;
      toast.success(`Reset ${ids.length} stuck brands`);
      await fetchIngestionHealth();
    } catch (e: any) {
      toast.error(e.message || "Failed to reset stuck brands");
    } finally {
      setRetrying(null);
    }
  }

  async function rerunCorroboration() {
    try {
      toast.info("Starting corroboration job...", {
        description: "Upgrading events with multi-domain support",
      });

      const { data, error } = await supabase.functions.invoke("upgrade-corroboration", {
        body: {},
      });

      if (error) throw error;

      toast.success("Corroboration completed", {
        description: `Upgraded ${data.upgraded} events across ${data.clusters} clusters`,
      });

      // Refresh health data
      await fetchHealth();
    } catch (e: any) {
      console.error("Corroboration error:", e);
      toast.error("Corroboration failed", {
        description: e.message || "Unknown error",
      });
    }
  }

  async function runQAValidation() {
    try {
      toast.info("Running QA validation...", {
        description: "Checking mixed events and feature flags",
      });

      const { data, error } = await supabase.functions.invoke("qa-mixed-flags", {
        body: {},
      });

      if (error) throw error;

      const result = data as QAResult;
      setQaResult(result);
      setShowQaModal(true);

      const failedChecks = result.checks?.filter((c) => c.status === 'FAIL') || [];
      const warningChecks = result.checks?.filter((c) => c.status === 'WARNING') || [];

      if (failedChecks.length > 0) {
        toast.error("QA Validation Failed", {
          description: `${failedChecks.length} check(s) failed. Click "View Details" for more info.`,
        });
      } else if (warningChecks.length > 0) {
        toast.warning("QA Validation Complete (Warnings)", {
          description: `${result.checks?.length - warningChecks.length} checks passed, ${warningChecks.length} warnings. Duration: ${result.duration_ms}ms`,
        });
      } else {
        toast.success("QA Validation Passed", {
          description: `All ${result.checks?.length} checks passed in ${result.duration_ms}ms. Found ${result.mixed_found} brands with mixed events.`,
        });
      }

      console.log('QA Validation Results:', result);
    } catch (e: any) {
      console.error("QA validation error:", e);
      
      if (e.message?.includes('429') || e.message?.includes('30s')) {
        toast.error("Rate limit exceeded", {
          description: "Please wait 30 seconds between QA runs",
        });
      } else {
        toast.error("QA validation failed", {
          description: e.message || "Unknown error",
        });
      }
    }
  }

  async function backfillSummaries() {
    try {
      toast.info("Summaries starting in background...", {
        description: "Check logs in a minute to see results",
      });

      const { data, error } = await supabase.functions.invoke("backfill-evidence-summaries", {
        body: { limit: 200, dryRun: false },
      });

      if (error) throw error;

      if (data.status === 'started') {
        toast.success("Batch job started", {
          description: `Processing up to ${data.limit} items in background`,
        });
      }
    } catch (e: any) {
      console.error("Backfill error:", e);
      toast.error("Failed to start summaries", {
        description: e.message || "Unknown error",
      });
    }
  }

  async function runHealthCheck() {
    setHealthLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("comprehensive-health", {
        body: {},
      });

      if (error) throw error;
      setHealthMetrics(data);
      
      const allGreen = data.evidence_recent && data.match_rate_ok && data.scores_fresh && data.homepage_ok;
      if (allGreen) {
        toast.success("All systems operational", {
          description: "Pipeline, scoring, and scanner are healthy",
        });
      } else {
        toast.warning("System health check complete", {
          description: "Some indicators need attention",
        });
      }
    } catch (e: any) {
      console.error("Health check error:", e);
      toast.error("Health check failed", {
        description: e.message || "Unknown error",
      });
    } finally {
      setHealthLoading(false);
    }
  }

  async function refreshMaterializedViews() {
    try {
      toast.info("Refreshing coverage data...", {
        description: "This will update event counts and metrics",
      });

      const { data, error } = await supabase.functions.invoke("refresh-materialized-views", {
        body: {},
      });

      if (error) throw error;

      toast.success("Coverage data refreshed", {
        description: "Brand event counts and metrics are now up to date",
      });
    } catch (e: any) {
      console.error("Refresh error:", e);
      toast.error("Failed to refresh coverage", {
        description: e.message || "Unknown error",
      });
    }
  }

  async function triggerScoring() {
    try {
      toast.info("Starting score calculation...", {
        description: "This will recalculate scores for all active brands",
      });

      const { data, error } = await supabase.functions.invoke("bulk-calculate-scores", {
        body: {},
      });

      if (error) throw error;

      toast.success("Scoring complete", {
        description: `Processed ${data.total || 0} brands, ${data.successful || 0} successful`,
      });
    } catch (e: any) {
      console.error("Scoring error:", e);
      toast.error("Failed to calculate scores", {
        description: e.message || "Unknown error",
      });
    }
  }

  if (!isAdmin) {
    return null;
  }

  const formatDuration = (ms?: number) => {
    if (!ms) return "—";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  return (
    <>
      <Helmet>
        <title>System Health - Admin</title>
      </Helmet>

      <div className="max-w-7xl mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              title="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">System Health</h1>
              <p className="text-muted-foreground mt-1">
                Monitor baseline calculation jobs and anomalies
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={refreshMaterializedViews} variant="outline" size="sm" className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <Activity className="w-4 h-4 mr-2" />
              Refresh Coverage Data
            </Button>
            <Button onClick={triggerScoring} variant="outline" size="sm" className="bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800">
              <Activity className="w-4 h-4 mr-2" />
              Calculate Scores
            </Button>
            <Button onClick={backfillSummaries} variant="outline" size="sm">
              <Activity className="w-4 h-4 mr-2" />
              Generate AI Summaries (200)
            </Button>
            <Button onClick={rerunCorroboration} variant="outline" size="sm">
              <Activity className="w-4 h-4 mr-2" />
              Re-run Corroboration
            </Button>
            <Button onClick={runQAValidation} variant="outline" size="sm">
              <CheckCircle className="w-4 h-4 mr-2" />
              Run Mixed/Flags QA (read-only)
            </Button>
            <Button onClick={fetchHealth} disabled={loading} variant="outline" size="sm">
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>

        {/* Comprehensive Health Check */}
        <Card className="p-6 border-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold">System Health Status</h2>
              <p className="text-sm text-muted-foreground mt-1">
                End-to-end validation: data → evidence → scores → scanner
              </p>
            </div>
            <Button onClick={runHealthCheck} disabled={healthLoading} size="sm">
              {healthLoading ? "Checking..." : "Run Health Check"}
            </Button>
          </div>

          {healthMetrics && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card className={`p-4 border-2 ${healthMetrics.evidence_recent ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-red-500 bg-red-50 dark:bg-red-950/20'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`text-2xl ${healthMetrics.evidence_recent ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {healthMetrics.evidence_recent ? '✓' : '✗'}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">Pipeline Active</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {healthMetrics.details.rss_matched_2h} matched / {healthMetrics.details.rss_items_2h} items
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className={`p-4 border-2 ${healthMetrics.match_rate_ok ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`text-2xl ${healthMetrics.match_rate_ok ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                      {healthMetrics.match_rate_ok ? '✓' : '⚠'}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">Match Rate</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {healthMetrics.details.match_rate_pct}% (target: ≥5%)
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className={`p-4 border-2 ${healthMetrics.scores_fresh ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-red-500 bg-red-50 dark:bg-red-950/20'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`text-2xl ${healthMetrics.scores_fresh ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {healthMetrics.scores_fresh ? '✓' : '✗'}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">Scores Fresh</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {healthMetrics.details.scores_updated_24h} updated (24h)
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className={`p-4 border-2 ${healthMetrics.homepage_ok ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`text-2xl ${healthMetrics.homepage_ok ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                      {healthMetrics.homepage_ok ? '✓' : '⚠'}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">Scanner Ready</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {healthMetrics.details.products_with_brands}/{healthMetrics.details.total_products} linked
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              <div className="text-xs text-muted-foreground">
                <strong>Next steps if unhealthy:</strong>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  <li>Pipeline inactive? Check pg_cron jobs and run pull-feeds + brand-match</li>
                  <li>Low match rate? Add brand_aliases for major CPG brands</li>
                  <li>Scores stale? Run calculate-baselines function</li>
                  <li>Homepage backlog high ({healthMetrics.details.homepage_pending})? Run resolve-evidence-links</li>
                </ul>
              </div>
            </>
          )}
        </Card>

        {/* Queue Health Status */}
        {queueHealth && (
          <Card className="p-6 border-2">
            <h3 className="text-lg font-semibold mb-4">Background Queue</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {queueHealth.ready_to_process}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Ready to Process</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {queueHealth.total_pending}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Total Pending</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                  {queueHealth.currently_processing}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Processing Now</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                  {queueHealth.failed_last_hour}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Failed (1h)</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-mono text-muted-foreground">
                  {queueHealth.oldest_pending 
                    ? formatDistanceToNow(new Date(queueHealth.oldest_pending), { addSuffix: true })
                    : '—'}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Oldest Pending</div>
              </div>
            </div>
          </Card>
        )}

        {/* Ingestion Health Widget */}
        <Card className="p-6 border-2 border-purple-200 dark:border-purple-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">Ingestion Health</h3>
              <p className="text-sm text-muted-foreground">Brand enrichment queue status</p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchIngestionHealth}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {ingestionHealth && (
            <>
              {/* Status counts */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                    {ingestionHealth.stub_count}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Stub</div>
                </div>
                <div className="text-center p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {ingestionHealth.building_count}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Building</div>
                </div>
                <div className="text-center p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {ingestionHealth.failed_count}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Failed</div>
                </div>
                <div className="text-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {ingestionHealth.ready_count}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Ready</div>
                </div>
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {ingestionHealth.ready_to_enrich}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Ready to Enrich</div>
                </div>
              </div>

              {/* Stuck Building Table */}
              {ingestionHealth.stuck_building.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Stuck Building ({ingestionHealth.stuck_building.length})
                    </h4>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={retryAllStuck}
                      disabled={retrying === 'all-stuck'}
                    >
                      {retrying === 'all-stuck' ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Reset All
                    </Button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground text-left">
                          <th className="p-2">Brand</th>
                          <th className="p-2">Stage</th>
                          <th className="p-2">Stuck Since</th>
                          <th className="p-2">Error</th>
                          <th className="p-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ingestionHealth.stuck_building.map((b) => (
                          <tr key={b.id} className="border-b hover:bg-muted/50">
                            <td className="p-2 font-medium">{b.name}</td>
                            <td className="p-2">
                              <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded text-xs">
                                {b.enrichment_stage || 'unknown'}
                              </span>
                            </td>
                            <td className="p-2 text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(b.updated_at), { addSuffix: true })}
                            </td>
                            <td className="p-2 text-xs text-muted-foreground max-w-xs truncate">
                              {b.enrichment_error || '—'}
                            </td>
                            <td className="p-2 text-right">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => retryBrand(b.id)}
                                disabled={retrying === b.id}
                              >
                                {retrying === b.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-4 w-4" />
                                )}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Failed Brands Table */}
              {ingestionHealth.failed_brands.length > 0 && (
                <div>
                  <h4 className="font-semibold text-red-600 dark:text-red-400 mb-3 flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    Failed Enrichment ({ingestionHealth.failed_brands.length})
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground text-left">
                          <th className="p-2">Brand</th>
                          <th className="p-2">Attempts</th>
                          <th className="p-2">Next Retry</th>
                          <th className="p-2">Error</th>
                          <th className="p-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ingestionHealth.failed_brands.map((b) => (
                          <tr key={b.id} className="border-b hover:bg-muted/50">
                            <td className="p-2 font-medium">{b.name}</td>
                            <td className="p-2">
                              <span className={`px-2 py-1 rounded text-xs ${
                                b.enrichment_attempts >= 5 
                                  ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                                  : 'bg-muted'
                              }`}>
                                {b.enrichment_attempts}/5
                              </span>
                            </td>
                            <td className="p-2 text-xs text-muted-foreground">
                              {b.next_enrichment_at 
                                ? formatDistanceToNow(new Date(b.next_enrichment_at), { addSuffix: true })
                                : '—'}
                            </td>
                            <td className="p-2 text-xs text-muted-foreground max-w-xs truncate" title={b.enrichment_error || undefined}>
                              {b.enrichment_error || '—'}
                            </td>
                            <td className="p-2 text-right">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => retryBrand(b.id)}
                                disabled={retrying === b.id}
                              >
                                {retrying === b.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-4 w-4" />
                                )}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* All healthy message */}
              {ingestionHealth.stuck_building.length === 0 && ingestionHealth.failed_brands.length === 0 && (
                <div className="text-center py-6 text-muted-foreground">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p>All brands are healthy — no stuck or failed enrichments</p>
                </div>
              )}
            </>
          )}
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Runs (24h)</div>
                <div className="text-2xl font-bold">{data?.totals?.last24h_runs ?? 0}</div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-500" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Anomalies (24h)</div>
                <div className="text-2xl font-bold">{data?.totals?.last24h_anomalies ?? 0}</div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/10 rounded-lg">
                <XCircle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Errors (24h)</div>
                <div className="text-2xl font-bold">{data?.totals?.total_errors_24h ?? 0}</div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Last Duration</div>
                <div className="text-2xl font-bold">
                  {formatDuration(data?.runs?.[0]?.duration_ms)}
                </div>
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Recent Job Runs</h2>
            <p className="text-sm text-muted-foreground">
              Last 20 baseline calculation jobs
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left p-3">Started</th>
                  <th className="text-left p-3">Mode</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-right p-3">Success</th>
                  <th className="text-right p-3">Errors</th>
                  <th className="text-right p-3">Anomalies</th>
                  <th className="text-right p-3">Duration</th>
                </tr>
              </thead>
              <tbody>
                {(data?.runs ?? []).map((r) => (
                  <tr key={r.id} className="border-b hover:bg-muted/50">
                    <td className="p-3 font-mono text-xs">{formatDate(r.started_at)}</td>
                    <td className="p-3">
                      <span className="px-2 py-1 bg-muted rounded text-xs font-medium">
                        {r.mode}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          r.status === 'completed'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : r.status === 'error'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">{r.success_count}</td>
                    <td className="p-3 text-right">
                      {r.error_count > 0 ? (
                        <span className="text-destructive font-medium">{r.error_count}</span>
                      ) : (
                        r.error_count
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {r.anomalies_count > 0 ? (
                        <span className="text-yellow-600 dark:text-yellow-500 font-medium">
                          {r.anomalies_count}
                        </span>
                      ) : (
                        r.anomalies_count
                      )}
                    </td>
                    <td className="p-3 text-right font-mono text-xs">
                      {formatDuration(r.duration_ms)}
                    </td>
                  </tr>
                ))}
                {!data?.runs?.length && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      No job runs recorded yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Recent Anomalies</h2>
            <p className="text-sm text-muted-foreground">
              Brands with score deltas ≥15 in the last 50 calculations
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left p-3">Detected</th>
                  <th className="text-left p-3">Brand</th>
                  <th className="text-left p-3">Category</th>
                  <th className="text-right p-3">Delta (90d vs 24m)</th>
                </tr>
              </thead>
              <tbody>
                {(data?.anomalies ?? []).map((a) => (
                  <tr key={a.id} className="border-b hover:bg-muted/50">
                    <td className="p-3 font-mono text-xs">{formatDate(a.created_at)}</td>
                    <td className="p-3 font-medium">{a.brands?.name ?? a.brand_id}</td>
                    <td className="p-3">
                      <span className="px-2 py-1 bg-muted rounded text-xs font-medium capitalize">
                        {a.category}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <span
                        className={`font-mono font-medium ${
                          Math.abs(a.delta) >= 15 ? 'text-yellow-600 dark:text-yellow-500' : ''
                        }`}
                      >
                        {a.delta > 0 ? '+' : ''}
                        {a.delta}
                      </span>
                    </td>
                  </tr>
                ))}
                {!data?.anomalies?.length && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-muted-foreground">
                      No anomalies detected
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Dialog open={showQaModal} onOpenChange={setShowQaModal}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>QA Validation Results</DialogTitle>
              <DialogDescription>
                Mixed events and feature flags validation · {qaResult?.duration_ms}ms
              </DialogDescription>
            </DialogHeader>
            
            {qaResult && (
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-3 gap-4">
                  <Card className="p-4">
                    <div className="text-sm text-muted-foreground">Brands Tested</div>
                    <div className="text-2xl font-bold">{qaResult.brands_tested}</div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-sm text-muted-foreground">Mixed Found</div>
                    <div className="text-2xl font-bold">{qaResult.mixed_found}</div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-sm text-muted-foreground">Caps OK</div>
                    <div className="text-2xl font-bold">
                      {qaResult.caps_ok ? '✓' : '✗'}
                    </div>
                  </Card>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold">Checks ({qaResult.checks.length})</h3>
                  {qaResult.checks.map((check, i) => (
                    <Card key={i} className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 ${
                          check.status === 'PASS' 
                            ? 'text-green-600 dark:text-green-400'
                            : check.status === 'FAIL'
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-yellow-600 dark:text-yellow-400'
                        }`}>
                          {check.status === 'PASS' && <CheckCircle className="w-5 h-5" />}
                          {check.status === 'FAIL' && <XCircle className="w-5 h-5" />}
                          {check.status === 'WARNING' && <AlertTriangle className="w-5 h-5" />}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{check.name}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {check.message}
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          check.status === 'PASS'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : check.status === 'FAIL'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}>
                          {check.status}
                        </span>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
