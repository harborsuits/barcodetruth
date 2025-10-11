import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Activity, AlertTriangle, Clock, XCircle, CheckCircle } from "lucide-react";
import { Helmet } from "react-helmet";
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

export default function AdminHealth() {
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [data, setData] = useState<HealthData | null>(null);
  const [qaResult, setQaResult] = useState<QAResult | null>(null);
  const [showQaModal, setShowQaModal] = useState(false);

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
    } catch (e: any) {
      console.error("Health fetch error:", e);
      toast.error(e.message || "Failed to load health data");
    } finally {
      setLoading(false);
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
      toast.info("Generating AI summaries...", {
        description: "This may take a minute for 50 items",
      });

      const { data, error } = await supabase.functions.invoke("backfill-evidence-summaries", {
        body: { limit: 50, dryRun: false },
      });

      if (error) throw error;

      if (data.processed === 0) {
        toast.info("No summaries needed", {
          description: "All evidence already has AI summaries",
        });
      } else {
        toast.success("Summaries generated", {
          description: `${data.succeeded} succeeded, ${data.failed} failed`,
        });
      }

      console.log('Backfill results:', data);
    } catch (e: any) {
      console.error("Backfill error:", e);
      toast.error("Failed to generate summaries", {
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
          <div>
            <h1 className="text-3xl font-bold">System Health</h1>
            <p className="text-muted-foreground mt-1">
              Monitor baseline calculation jobs and anomalies
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={backfillSummaries} variant="outline" size="sm">
              <Activity className="w-4 h-4 mr-2" />
              Generate AI Summaries (50)
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
