import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RefreshCw, Activity, Database, Package, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "@/hooks/use-toast";

type HealthData = {
  events_24h: number;
  events_7d: number;
  events_30d: number;
  brands_with_events_7d: number;
  newest_event_age_seconds: number;
  products_with_barcodes: number;
  brands_with_parents: number;
  brands_with_shareholders: number;
  brands_with_key_people: number;
  rss_queued: number;
  rss_matched: number;
  rss_rejected: number;
  last_pull_feeds: string | null;
  last_brand_match: string | null;
};

function MetricCard({
  title,
  value,
  subtext,
  icon: Icon,
  status,
}: {
  title: string;
  value: string | number;
  subtext?: string;
  icon: React.ElementType;
  status?: "good" | "warning" | "critical";
}) {
  const statusColors = {
    good: "text-green-600 dark:text-green-400",
    warning: "text-yellow-600 dark:text-yellow-400",
    critical: "text-red-600 dark:text-red-400",
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <Icon className={`h-5 w-5 ${status ? statusColors[status] : ""}`} />
          </div>
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm text-muted-foreground">{title}</p>
            {subtext && <p className="text-xs text-muted-foreground">{subtext}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminIngestionHealth() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["ingestion-health"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_ingestion_health");
      if (error) throw error;
      return data as HealthData;
    },
    refetchInterval: 30000, // Auto-refresh every 30s
  });

  const handleManualOrchestrator = async () => {
    toast({ title: "Triggering news orchestrator..." });
    try {
      const { error } = await supabase.functions.invoke("unified-news-orchestrator", {
        body: { daysBack: 3, max: 20 },
      });
      if (error) throw error;
      toast({ title: "Orchestrator run complete", description: "Check events in a few minutes" });
      refetch();
    } catch (e) {
      toast({ title: "Error", description: String(e), variant: "destructive" });
    }
  };

  const handleManualSnapshots = async () => {
    toast({ title: "Publishing snapshots..." });
    try {
      const { error } = await supabase.functions.invoke("publish-snapshots");
      if (error) throw error;
      toast({ title: "Snapshots published successfully" });
    } catch (e) {
      toast({ title: "Error", description: String(e), variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold">Ingestion Health</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array(8).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  const eventStatus = (data?.events_24h ?? 0) >= 5 ? "good" : (data?.events_24h ?? 0) > 0 ? "warning" : "critical";
  const newestAge = data?.newest_event_age_seconds ?? Infinity;
  const ageStatus = newestAge < 3600 ? "good" : newestAge < 86400 ? "warning" : "critical";

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ingestion Health Dashboard</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleManualOrchestrator}>
            Run Orchestrator
          </Button>
          <Button variant="outline" size="sm" onClick={handleManualSnapshots}>
            Publish Snapshots
          </Button>
        </div>
      </div>

      {/* Event Ingestion */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Event Ingestion
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              title="Events (24h)"
              value={data?.events_24h ?? 0}
              icon={Activity}
              status={eventStatus}
            />
            <MetricCard
              title="Events (7d)"
              value={data?.events_7d ?? 0}
              icon={Activity}
            />
            <MetricCard
              title="Events (30d)"
              value={data?.events_30d ?? 0}
              icon={Activity}
            />
            <MetricCard
              title="Newest Event Age"
              value={newestAge < 60 ? "< 1 min" : newestAge < 3600 ? `${Math.round(newestAge / 60)} min` : `${Math.round(newestAge / 3600)} hrs`}
              icon={Activity}
              status={ageStatus}
            />
          </div>
        </CardContent>
      </Card>

      {/* RSS Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            RSS Pipeline Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-2xl font-bold">{data?.rss_queued ?? 0}</p>
              <p className="text-sm text-muted-foreground">Queued</p>
            </div>
            <div className="text-center p-4 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{data?.rss_matched ?? 0}</p>
              <p className="text-sm text-muted-foreground">Matched</p>
            </div>
            <div className="text-center p-4 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
              <p className="text-2xl font-bold text-yellow-600">{data?.rss_rejected ?? 0}</p>
              <p className="text-sm text-muted-foreground">Rejected</p>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-2xl font-bold">{data?.brands_with_events_7d ?? 0}</p>
              <p className="text-sm text-muted-foreground">Active Brands</p>
            </div>
          </div>

          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>
              Last pull-feeds:{" "}
              {data?.last_pull_feeds
                ? formatDistanceToNow(new Date(data.last_pull_feeds), { addSuffix: true })
                : "Never"}
            </span>
            <span>
              Last brand-match:{" "}
              {data?.last_brand_match
                ? formatDistanceToNow(new Date(data.last_brand_match), { addSuffix: true })
                : "Never"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Data Coverage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Data Coverage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              title="Products w/ Barcodes"
              value={data?.products_with_barcodes ?? 0}
              icon={Package}
            />
            <MetricCard
              title="Brands w/ Parents"
              value={data?.brands_with_parents ?? 0}
              icon={Users}
            />
            <MetricCard
              title="Brands w/ Shareholders"
              value={data?.brands_with_shareholders ?? 0}
              icon={Users}
            />
            <MetricCard
              title="Brands w/ Key People"
              value={data?.brands_with_key_people ?? 0}
              icon={Users}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
