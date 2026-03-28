import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Users, ScanLine, MousePointerClick, TrendingUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function BehaviorAnalytics() {
  // Summary stats
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-behavior-stats"],
    queryFn: async () => {
      // Sessions
      const { count: totalSessions } = await supabase
        .from("analytics_sessions")
        .select("*", { count: "exact", head: true });

      const { count: multiScanSessions } = await supabase
        .from("analytics_sessions")
        .select("*", { count: "exact", head: true })
        .gte("scan_count", 2);

      // Events
      const { data: eventCounts } = await supabase
        .from("analytics_events")
        .select("event_name")
        .order("created_at", { ascending: false })
        .limit(1000);

      const counts: Record<string, number> = {};
      (eventCounts || []).forEach((e: any) => {
        counts[e.event_name] = (counts[e.event_name] || 0) + 1;
      });

      // Alt click rate
      const altViewed = counts["alternatives_viewed"] || 0;
      const altClicked = counts["alternative_clicked"] || 0;
      const altCtr = altViewed > 0 ? Math.round((altClicked / altViewed) * 100) : 0;

      // Scan-to-second-scan rate
      const scanRate = totalSessions && totalSessions > 0
        ? Math.round(((multiScanSessions || 0) / totalSessions) * 100)
        : 0;

      return {
        totalSessions: totalSessions || 0,
        multiScanSessions: multiScanSessions || 0,
        scanRate,
        altCtr,
        eventCounts: counts,
        totalEvents: eventCounts?.length || 0,
      };
    },
    refetchInterval: 30_000,
  });

  // Recent events feed
  const { data: recentEvents } = useQuery({
    queryKey: ["admin-behavior-recent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("analytics_events")
        .select("event_name, created_at, barcode, brand_id, properties")
        .order("created_at", { ascending: false })
        .limit(30);
      return data || [];
    },
    refetchInterval: 15_000,
  });

  // Weak result abandonment
  const { data: abandonmentData } = useQuery({
    queryKey: ["admin-behavior-abandonment"],
    queryFn: async () => {
      const { data } = await supabase
        .from("analytics_events")
        .select("properties")
        .eq("event_name", "session_ended")
        .order("created_at", { ascending: false })
        .limit(100);

      let weakEnds = 0;
      (data || []).forEach((e: any) => {
        const p = e.properties || {};
        if (!p.ownership_present || !p.alternatives_better_count || p.score_band === "unrated") {
          weakEnds++;
        }
      });

      return {
        total: data?.length || 0,
        weakEnds,
        rate: data?.length ? Math.round((weakEnds / data.length) * 100) : 0,
      };
    },
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const s = stats!;
  const keyEvents = [
    "scan_opened", "scan_success", "scan_failed",
    "profile_loaded", "ownership_opened", "evidence_opened",
    "alternatives_viewed", "alternative_clicked",
    "share_clicked", "search_again",
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        User Behavior Analytics
      </h2>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 text-center">
            <Users className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-2xl font-bold">{s.totalSessions}</p>
            <p className="text-xs text-muted-foreground">Total Sessions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-2xl font-bold">{s.scanRate}%</p>
            <p className="text-xs text-muted-foreground">Multi-Scan Rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <MousePointerClick className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-2xl font-bold">{s.altCtr}%</p>
            <p className="text-xs text-muted-foreground">Alt Click-Through</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <ScanLine className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-2xl font-bold">{abandonmentData?.rate ?? 0}%</p>
            <p className="text-xs text-muted-foreground">Weak-Result Drop</p>
          </CardContent>
        </Card>
      </div>

      {/* Event funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Event Funnel (last 1000 events)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {keyEvents.map((name) => {
              const count = s.eventCounts[name] || 0;
              const maxCount = Math.max(...keyEvents.map((n) => s.eventCounts[n] || 0), 1);
              const pct = Math.round((count / maxCount) * 100);
              return (
                <div key={name} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-36 truncate font-mono">{name}</span>
                  <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                    <div
                      className="bg-primary/70 h-full rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium w-10 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Live feed */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Live Event Feed</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {(recentEvents || []).map((e: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-xs py-1 border-b last:border-0">
                <Badge variant="outline" className="font-mono text-[10px]">
                  {e.event_name}
                </Badge>
                {e.barcode && (
                  <span className="text-muted-foreground font-mono">{e.barcode}</span>
                )}
                {e.properties?.brand_name && (
                  <span className="text-foreground truncate max-w-[120px]">
                    {e.properties.brand_name}
                  </span>
                )}
                <span className="ml-auto text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                </span>
              </div>
            ))}
            {(!recentEvents || recentEvents.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No events yet. Start scanning to generate data.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
