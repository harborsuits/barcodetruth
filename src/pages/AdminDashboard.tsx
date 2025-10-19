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
  ArrowLeft
} from "lucide-react";
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
        queue
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
        supabase.from('processing_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending')
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
      } as DashboardMetrics;
    },
    refetchInterval: 30000, // Refresh every 30s
  });

  const adminTools = [
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

        {/* High Priority Tools */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Critical Operations</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {highPriority.map((tool) => {
              const Icon = tool.icon;
              return (
                <Card key={tool.route} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(tool.route)}>
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
                    <Button className="w-full" variant="outline">
                      Open Tool
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
      </main>
    </div>
  );
}
