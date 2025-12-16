import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Database,
  FileText,
  AlertCircle,
  TrendingUp,
  Activity,
  Settings,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  Package,
  Users,
  Shield,
  BarChart3,
  Zap,
  ArrowLeft,
  RefreshCw
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface DashboardMetrics {
  events_24h: number;
  events_7d: number;
  events_total: number;
  brands_active: number;
  brands_scored: number;
  unverified_events: number;
  irrelevant_events: number;
  pending_claims: number;
  failed_jobs: number;
  queue_pending: number;
  brands_stub: number;
  brands_building: number;
  brands_ready: number;
  brands_failed: number;
}

export default function AdminDashboard() {
  const navigate = useNavigate();

  // Fetch dashboard metrics
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['admin-dashboard-metrics'],
    queryFn: async () => {
      // Get event counts
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [
        events24h,
        events7d,
        eventsTotal,
        brands,
        scores,
        unverified,
        irrelevant,
        claims,
        failedJobs,
        queue,
        brandsStub,
        brandsBuilding,
        brandsReady,
        brandsFailed
      ] = await Promise.all([
        supabase.from('brand_events').select('event_id', { count: 'exact', head: true }).gte('created_at', yesterday.toISOString()),
        supabase.from('brand_events').select('event_id', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString()),
        supabase.from('brand_events').select('event_id', { count: 'exact', head: true }),
        supabase.from('brands').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('brand_scores').select('brand_id', { count: 'exact', head: true }),
        supabase.from('brand_events').select('event_id', { count: 'exact', head: true }).eq('verification', 'unverified'),
        supabase.from('brand_events').select('event_id', { count: 'exact', head: true }).eq('is_irrelevant', true),
        supabase.from('product_claims').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('processing_queue').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('created_at', yesterday.toISOString()),
        supabase.from('processing_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('brands').select('id', { count: 'exact', head: true }).eq('status', 'stub'),
        supabase.from('brands').select('id', { count: 'exact', head: true }).eq('status', 'building'),
        supabase.from('brands').select('id', { count: 'exact', head: true }).eq('status', 'ready'),
        supabase.from('brands').select('id', { count: 'exact', head: true }).eq('status', 'failed')
      ]);

      return {
        events_24h: events24h.count || 0,
        events_7d: events7d.count || 0,
        events_total: eventsTotal.count || 0,
        brands_active: brands.count || 0,
        brands_scored: scores.count || 0,
        unverified_events: unverified.count || 0,
        irrelevant_events: irrelevant.count || 0,
        pending_claims: claims.count || 0,
        failed_jobs: failedJobs.count || 0,
        queue_pending: queue.count || 0,
        brands_stub: brandsStub.count || 0,
        brands_building: brandsBuilding.count || 0,
        brands_ready: brandsReady.count || 0,
        brands_failed: brandsFailed.count || 0,
      } as DashboardMetrics;
    },
    refetchInterval: 30000, // Refresh every 30s
  });

  const adminTools = [
    {
      title: "🚀 System-Wide Heal",
      description: "Run complete database heal to populate ALL brands (company, people, shareholders)",
      icon: Zap,
      route: null,
      action: "system-heal",
      color: "text-red-600 dark:text-red-400",
      bgColor: "bg-red-600/10",
      priority: "high",
      metrics: "ONE-TIME FIX"
    },
    {
      title: "🔧 Fix Missing Key People",
      description: "Enrich key people for brands missing this data (one-time fix for system heal bug)",
      icon: Users,
      route: null,
      action: "fix-key-people",
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-600/10",
      priority: "high",
      metrics: "Bug Fix"
    },
    {
      title: "Event Management",
      description: "Browse, filter, and manage all brand events",
      icon: Calendar,
      route: "/admin/events",
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-600/10",
      priority: "high",
      metrics: metrics ? `${metrics.events_total.toLocaleString()} total` : "—"
    },
    {
      title: "System Health",
      description: "Monitor jobs, anomalies, and system performance",
      icon: Activity,
      route: "/admin/health",
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-600/10",
      priority: "high",
      metrics: metrics?.failed_jobs ? `${metrics.failed_jobs} failed` : "All healthy"
    },
    {
      title: "Review Queue",
      description: "Review unverified events and attach sources",
      icon: Shield,
      route: "/admin/review",
      color: "text-orange-600 dark:text-orange-400",
      bgColor: "bg-orange-600/10",
      priority: "high",
      metrics: metrics ? `${metrics.unverified_events} unverified` : "—"
    },
    {
      title: "Category Tester",
      description: "Test article categorization rules",
      icon: Zap,
      route: "/admin/category-tester",
      color: "text-pink-600 dark:text-pink-400",
      bgColor: "bg-pink-600/10",
      priority: "high",
      metrics: "Testing tool"
    },
    {
      title: "Ops Health",
      description: "24h operational health metrics and guardrails",
      icon: BarChart3,
      route: "/admin/ops-health",
      color: "text-cyan-600 dark:text-cyan-400",
      bgColor: "bg-cyan-600/10",
      priority: "high",
      metrics: metrics ? `${metrics.events_24h} events` : "—"
    },
    {
      title: "Reclassify Events",
      description: "Apply categorization rules to all events",
      icon: RefreshCw,
      route: null,
      action: "reclassify",
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-600/10",
      priority: "high",
      metrics: "One-time fix"
    },
    {
      title: "Enrich Key People",
      description: "Bulk enrich key people for all brands with Wikidata QIDs",
      icon: Users,
      route: null,
      action: "enrich-people",
      color: "text-indigo-600 dark:text-indigo-400",
      bgColor: "bg-indigo-600/10",
      priority: "high",
      metrics: "Bulk enrichment"
    },
    {
      title: "Fortune 500 Enrichment",
      description: "One-click bulk enrichment for major public companies",
      icon: Users,
      route: "/admin/fortune-500-enrich",
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-600/10",
      priority: "high",
      metrics: "Batch tool"
    },
    {
      title: "Claims Moderation",
      description: "Review user-submitted product-to-brand mappings",
      icon: Package,
      route: "/admin/claims",
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-600/10",
      priority: "medium",
      metrics: metrics ? `${metrics.pending_claims} pending` : "—"
    },
    {
      title: "User Management",
      description: "View and manage all registered users",
      icon: Users,
      route: "/admin/users",
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-600/10",
      priority: "high",
      metrics: "User profiles"
    },
    {
      title: "Community Ratings",
      description: "Monitor and moderate brand & people ratings",
      icon: Users,
      route: "/admin/community-ratings",
      color: "text-indigo-600 dark:text-indigo-400",
      bgColor: "bg-indigo-600/10",
      priority: "medium",
      metrics: "Community feedback"
    },
    {
      title: "Ingestion Control",
      description: "Monitor queue status and brand processing",
      icon: Database,
      route: "/admin/ingestion",
      color: "text-cyan-600 dark:text-cyan-400",
      bgColor: "bg-cyan-600/10",
      priority: "medium",
      metrics: metrics ? `${metrics.queue_pending} in queue` : "—"
    },
    {
      title: "Product Seeding",
      description: "Seed products from CSV or OpenFoodFacts",
      icon: Package,
      route: "/admin/seeding",
      color: "text-lime-600 dark:text-lime-400",
      bgColor: "bg-lime-600/10",
      priority: "medium",
      metrics: "Data import"
    },
    {
      title: "Manual Triggers",
      description: "Run enrichment and scoring jobs on demand",
      icon: Zap,
      route: "/admin/triggers",
      color: "text-yellow-600 dark:text-yellow-400",
      bgColor: "bg-yellow-600/10",
      priority: "low",
      metrics: "On-demand"
    },
    {
      title: "Add Evidence",
      description: "Manually add brand events with sources",
      icon: FileText,
      route: "/admin/evidence/new",
      color: "text-indigo-600 dark:text-indigo-400",
      bgColor: "bg-indigo-600/10",
      priority: "medium",
      metrics: "Manual entry"
    },
    {
      title: "News Testing",
      description: "Test news ingestion and categorization",
      icon: BarChart3,
      route: "/admin/news-test",
      color: "text-pink-600 dark:text-pink-400",
      bgColor: "bg-pink-600/10",
      priority: "low",
      metrics: "Dev tool"
    },
    {
      title: "Relevance Scorer Test",
      description: "Test article relevance scoring and batch processing",
      icon: Activity,
      route: "/admin/test-scorer",
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-600/10",
      priority: "low",
      metrics: "Debug tool"
    },
    {
      title: "Edge Function Tester",
      description: "Test edge functions with proper parameters and see results",
      icon: Zap,
      route: "/admin/test",
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-600/10",
      priority: "low",
      metrics: "Debug tool"
    },
  ];

  const highPriority = adminTools.filter(t => t.priority === 'high');
  const mediumPriority = adminTools.filter(t => t.priority === 'medium');
  const lowPriority = adminTools.filter(t => t.priority === 'low');

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-card border-b">
        <div className="container max-w-7xl mx-auto px-4 py-6">
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
                <h1 className="text-3xl font-bold flex items-center gap-3">
                  <Shield className="h-8 w-8 text-primary" />
                  Admin Dashboard
                </h1>
                <p className="text-muted-foreground mt-2">
                  Central hub for managing Barcode Truth operations
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => navigate('/settings')}>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-7xl mx-auto px-4 py-6 space-y-8">
        {/* Key Metrics */}
        <div>
          <h2 className="text-xl font-semibold mb-4">System Overview</h2>
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <div className="h-16 bg-muted/50 animate-pulse rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-blue-500" />
                    <span className="text-sm text-muted-foreground">Events (24h)</span>
                  </div>
                  <div className="text-3xl font-bold">{metrics?.events_24h.toLocaleString()}</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-muted-foreground">Events (7d)</span>
                  </div>
                  <div className="text-3xl font-bold">{metrics?.events_7d.toLocaleString()}</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="h-4 w-4 text-purple-500" />
                    <span className="text-sm text-muted-foreground">Total Events</span>
                  </div>
                  <div className="text-3xl font-bold">{metrics?.events_total.toLocaleString()}</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-4 w-4 text-cyan-500" />
                    <span className="text-sm text-muted-foreground">Active Brands</span>
                  </div>
                  <div className="text-3xl font-bold">{metrics?.brands_active.toLocaleString()}</div>
                </CardContent>
              </Card>

              <Card className={metrics?.unverified_events ? "border-yellow-500/50" : ""}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm text-muted-foreground">Unverified</span>
                  </div>
                  <div className="text-3xl font-bold text-yellow-600">
                    {metrics?.unverified_events.toLocaleString()}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-muted-foreground">Brands Scored</span>
                  </div>
                  <div className="text-3xl font-bold">{metrics?.brands_scored.toLocaleString()}</div>
                </CardContent>
              </Card>

              <Card className={metrics?.pending_claims ? "border-purple-500/50" : ""}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-purple-500" />
                    <span className="text-sm text-muted-foreground">Pending Claims</span>
                  </div>
                  <div className="text-3xl font-bold">{metrics?.pending_claims.toLocaleString()}</div>
                </CardContent>
              </Card>

              <Card className={metrics?.failed_jobs ? "border-red-500/50" : ""}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm text-muted-foreground">Failed Jobs</span>
                  </div>
                  <div className="text-3xl font-bold text-red-600">
                    {metrics?.failed_jobs.toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Brand Build Health */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Brand Build Health</h2>
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-3 bg-yellow-500/10 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{metrics?.brands_stub || 0}</div>
                  <div className="text-sm text-muted-foreground">Stubs</div>
                </div>
                <div className="text-center p-3 bg-blue-500/10 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{metrics?.brands_building || 0}</div>
                  <div className="text-sm text-muted-foreground">Building</div>
                </div>
                <div className="text-center p-3 bg-green-500/10 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{metrics?.brands_ready || 0}</div>
                  <div className="text-sm text-muted-foreground">Ready</div>
                </div>
                <div className="text-center p-3 bg-red-500/10 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{metrics?.brands_failed || 0}</div>
                  <div className="text-sm text-muted-foreground">Failed</div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={async () => {
                    toast({ title: "Running brand stub processor..." });
                    try {
                      const { data, error } = await supabase.functions.invoke('process-brand-stubs');
                      if (error) throw error;
                      toast({
                        title: "✅ Stub processing complete",
                        description: `Processed: ${data?.processed || 0} | Succeeded: ${data?.succeeded || 0} | Failed: ${data?.failed || 0}`,
                      });
                    } catch (e: any) {
                      toast({ title: "Error", description: e.message, variant: "destructive" });
                    }
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Run Stub Builder Now
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* High Priority Tools */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Critical Operations</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {highPriority.map((tool) => {
              const Icon = tool.icon;
              
              const handleClick = async () => {
                if (tool.action === "system-heal") {
                  if (!confirm("⚠️ THIS WILL RUN A COMPLETE SYSTEM-WIDE HEAL\n\nThis will:\n• Process EVERY brand in the database\n• Seed company data\n• Enrich key people\n• Add shareholders\n• Take 45-60 minutes\n\nContinue?")) {
                    return;
                  }
                  
                  try {
                    toast({
                      title: "🚀 System-Wide Heal Started!",
                      description: "This will take 45-60 minutes. Check edge function logs for progress.",
                    });
                    
                    const { data, error } = await supabase.functions.invoke('run-system-wide-heal');
                    
                    if (error) throw error;
                    
                    if (data.success) {
                      const result = data.summary;
                      toast({
                        title: "✅ System-Wide Heal Complete!",
                        description: `Total: ${result.total} | Seeded: ${result.seeded} | Enriched: ${result.enriched} | Skipped: ${result.skipped} | Errors: ${result.errors}`,
                      });
                    } else {
                      throw new Error(data.error || 'Unknown error');
                    }
                  } catch (error: any) {
                    toast({
                      title: "System heal failed",
                      description: error.message,
                      variant: "destructive",
                    });
                  }
                } else if (tool.action === "reclassify") {
                  try {
                    toast({
                      title: "Starting reclassification...",
                      description: "This may take a minute",
                    });
                    const { data, error } = await supabase.functions.invoke('reclassify-events');
                    if (error) throw error;
                    if (data.success) {
                      const result = data.results;
                      toast({
                        title: "Reclassification complete!",
                        description: `Updated ${result.updated_count} events: ${result.financial_count} financial, ${result.recall_count} recalls, ${result.legal_count} legal, ${result.regulatory_count} regulatory`,
                      });
                    } else {
                      throw new Error(data.error || 'Unknown error');
                    }
                  } catch (error: any) {
                    toast({
                      title: "Reclassification failed",
                      description: error.message,
                      variant: "destructive",
                    });
                  }
                } else if (tool.action === "fix-key-people") {
                  try {
                    if (!confirm("🔧 FIX MISSING KEY PEOPLE\n\nThis will:\n• Find brands with ownership but no key people\n• Call enrich-brand-wiki for each\n• Fetch real data from Wikidata\n• Take ~20 seconds\n\nContinue?")) {
                      return;
                    }

                    toast({
                      title: "🔧 Starting fix...",
                      description: "Finding brands missing key people data...",
                    });
                    
                    const { data, error } = await supabase.functions.invoke('fix-missing-key-people');
                    
                    if (error) throw error;
                    
                    if (data.success) {
                      const result = data.summary;
                      toast({
                        title: "✅ Fix Complete!",
                        description: `Processed: ${result.total} | Enriched: ${result.enriched} | Failed: ${result.failed}`,
                      });
                    } else {
                      throw new Error(data.error || 'Unknown error');
                    }
                  } catch (error: any) {
                    toast({
                      title: "Fix failed",
                      description: error.message,
                      variant: "destructive",
                    });
                  }
                } else if (tool.action === "enrich-people") {
                  try {
                    toast({
                      title: "Starting bulk enrichment...",
                      description: "Fetching key people for all brands. This may take several minutes.",
                    });

                    // Fetch all brands with Wikidata QIDs
                    const { data: brands, error: fetchError } = await supabase
                      .from('brands')
                      .select('id, name, wikidata_qid')
                      .not('wikidata_qid', 'is', null)
                      .eq('is_active', true)
                      .limit(50); // Process 50 brands at a time to avoid timeout

                    if (fetchError) throw fetchError;

                    let processed = 0;
                    let succeeded = 0;
                    let failed = 0;

                    for (const brand of brands || []) {
                      try {
                        console.log(`[Bulk Enrich] Processing: ${brand.name}`);
                        const { error } = await supabase.functions.invoke('enrich-brand-wiki', {
                          body: {
                            brand_id: brand.id,
                            wikidata_qid: brand.wikidata_qid,
                            mode: 'full'
                          }
                        });

                        if (error) {
                          console.error(`[Bulk Enrich] Error for ${brand.name}:`, error);
                          failed++;
                        } else {
                          succeeded++;
                        }
                        
                        processed++;
                        
                        // Rate limit: 2 seconds between brands
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        
                        // Update progress
                        if (processed % 5 === 0) {
                          toast({
                            title: `Progress: ${processed}/${brands?.length || 0}`,
                            description: `${succeeded} succeeded, ${failed} failed`
                          });
                        }
                      } catch (err: any) {
                        console.error(`[Bulk Enrich] Exception for ${brand.name}:`, err);
                        failed++;
                        processed++;
                      }
                    }

                    toast({
                      title: "Bulk enrichment complete!",
                      description: `Processed ${processed} brands: ${succeeded} succeeded, ${failed} failed`,
                    });
                  } catch (error: any) {
                    toast({
                      title: "Bulk enrichment failed",
                      description: error.message,
                      variant: "destructive",
                    });
                  }
                } else if (tool.route) {
                  navigate(tool.route);
                }
              };
              
              return (
                <Card key={tool.route || tool.title} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={handleClick}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className={`p-3 rounded-lg ${tool.bgColor}`}>
                        <Icon className={`h-6 w-6 ${tool.color}`} />
                      </div>
                      <Badge variant="outline">{tool.metrics}</Badge>
                    </div>
                    <CardTitle className="mt-4">{tool.title}</CardTitle>
                    <CardDescription>{tool.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" variant={tool.action === "system-heal" ? "destructive" : "outline"}>
                      {tool.action === "system-heal" ? "🚀 RUN NOW" : 
                       tool.action === "fix-key-people" ? "🔧 FIX NOW" :
                       tool.action === "reclassify" ? "Run Now" : 
                       tool.action === "enrich-people" ? "Enrich All" : 
                       "Open Tool"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Medium Priority Tools */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Data Management</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {mediumPriority.map((tool) => {
              const Icon = tool.icon;
              return (
                <Card key={tool.route} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(tool.route)}>
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center text-center gap-3">
                      <div className={`p-3 rounded-lg ${tool.bgColor}`}>
                        <Icon className={`h-5 w-5 ${tool.color}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm">{tool.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1">{tool.description}</p>
                        <Badge variant="secondary" className="mt-2 text-xs">
                          {tool.metrics}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Low Priority Tools */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Advanced Tools</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {lowPriority.map((tool) => {
              const Icon = tool.icon;
              return (
                <Card key={tool.route} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(tool.route)}>
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center text-center gap-3">
                      <div className={`p-3 rounded-lg ${tool.bgColor}`}>
                        <Icon className={`h-5 w-5 ${tool.color}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm">{tool.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1">{tool.description}</p>
                        <Badge variant="outline" className="mt-2 text-xs">
                          {tool.metrics}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2"
                onClick={() => navigate('/admin/events')}
              >
                <Calendar className="h-5 w-5" />
                <span className="text-sm">View Events</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2"
                onClick={() => navigate('/admin/claims')}
              >
                <Package className="h-5 w-5" />
                <span className="text-sm">Review Claims</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2"
                onClick={() => navigate('/admin/evidence/new')}
              >
                <FileText className="h-5 w-5" />
                <span className="text-sm">Add Evidence</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2"
                onClick={() => navigate('/admin/triggers')}
              >
                <Zap className="h-5 w-5" />
                <span className="text-sm">Run Jobs</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* System Status */}
        {metrics && (
          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Active Brands</span>
                  </div>
                  <Badge variant="outline">{metrics.brands_active} / {metrics.brands_scored} scored</Badge>
                </div>
                
                <div className="flex items-center justify-between py-2 border-b">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">Event Activity</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {metrics.events_24h} today • {metrics.events_7d} this week
                  </div>
                </div>

                <div className="flex items-center justify-between py-2 border-b">
                  <div className="flex items-center gap-2">
                    {metrics.unverified_events > 0 ? (
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    <span className="text-sm">Verification Status</span>
                  </div>
                  <Badge variant={metrics.unverified_events > 0 ? "outline" : "secondary"}>
                    {metrics.unverified_events} unverified
                  </Badge>
                </div>

                <div className="flex items-center justify-between py-2 border-b">
                  <div className="flex items-center gap-2">
                    {metrics.pending_claims > 0 ? (
                      <Clock className="h-4 w-4 text-purple-500" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    <span className="text-sm">User Claims</span>
                  </div>
                  <Badge variant={metrics.pending_claims > 0 ? "secondary" : "outline"}>
                    {metrics.pending_claims} pending review
                  </Badge>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    {metrics.failed_jobs > 0 ? (
                      <XCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    <span className="text-sm">Background Jobs</span>
                  </div>
                  <Badge variant={metrics.failed_jobs > 0 ? "destructive" : "outline"}>
                    {metrics.failed_jobs > 0 ? `${metrics.failed_jobs} failed` : 'All healthy'}
                  </Badge>
                 </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Access Tools */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Access</CardTitle>
            <CardDescription>Testing and diagnostic tools</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Button 
              variant="outline"
              onClick={() => navigate("/admin/test-scorer")}
              className="w-full"
            >
              <Zap className="mr-2 h-4 w-4" />
              Test Scorer
            </Button>
            <Button 
              variant="outline"
              onClick={() => navigate("/admin/ops-health")}
              className="w-full"
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              Ops Health
            </Button>
            <Button 
              variant="outline"
              onClick={() => navigate("/admin/category-tester")}
              className="w-full"
            >
              <Activity className="mr-2 h-4 w-4" />
              Category Tester
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
