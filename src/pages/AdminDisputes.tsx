import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Check, X } from "lucide-react";

export default function AdminDisputes() {
  const queryClient = useQueryClient();
  const [processing, setProcessing] = useState<string | null>(null);

  const { data: disputes, isLoading } = useQuery({
    queryKey: ["admin-disputes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("event_disputes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  const { data: events } = useQuery({
    queryKey: ["admin-dispute-events", disputes?.map(d => (d as any).event_id)],
    queryFn: async () => {
      const ids = disputes?.map(d => (d as any).event_id) || [];
      if (ids.length === 0) return {};
      const { data } = await supabase
        .from("brand_events")
        .select("event_id, title, source_url, brand_id")
        .in("event_id", ids);
      const map: Record<string, any> = {};
      data?.forEach(e => { map[e.event_id] = e; });
      return map;
    },
    enabled: !!disputes && disputes.length > 0,
  });

  const handleResolve = async (disputeId: string, action: "approved" | "rejected") => {
    setProcessing(disputeId);
    try {
      // Update dispute status
      await supabase
        .from("event_disputes")
        .update({ status: action, resolved_at: new Date().toISOString() } as any)
        .eq("id", disputeId);

      // If approved, mark event as disputed and exclude from scoring
      if (action === "approved") {
        const dispute = disputes?.find(d => (d as any).id === disputeId);
        if (dispute) {
          await supabase
            .from("brand_events")
            .update({ disputed: true, score_excluded_reason: "disputed" } as any)
            .eq("event_id", (dispute as any).event_id);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["admin-disputes"] });
    } catch (err) {
      console.error("Failed to resolve dispute:", err);
    } finally {
      setProcessing(null);
    }
  };

  const pending = disputes?.filter(d => (d as any).status === "pending") || [];
  const resolved = disputes?.filter(d => (d as any).status !== "pending") || [];

  return (
    <div className="min-h-screen bg-background">
      <main className="container max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Disputed Events</h1>
          <p className="text-sm text-muted-foreground">
            {pending.length} pending · {resolved.length} resolved
          </p>
        </div>

        {isLoading && <p className="text-muted-foreground text-center py-8">Loading…</p>}

        {pending.length === 0 && !isLoading && (
          <p className="text-muted-foreground text-center py-8">No pending disputes 🎉</p>
        )}

        {pending.map((d: any) => {
          const event = events?.[d.event_id];
          return (
            <Card key={d.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-sm">{event?.title || "Unknown event"}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Disputed: {d.dispute_type} · {new Date(d.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-warning border-warning/30">Pending</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {d.description && <p className="text-sm">{d.description}</p>}
                
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {d.email && <span>From: {d.email}</span>}
                  {d.supporting_url && (
                    <a href={d.supporting_url} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                      Supporting link <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                  {event?.source_url && (
                    <a href={event.source_url} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                      Original article <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleResolve(d.id, "approved")}
                    disabled={processing === d.id}
                  >
                    <Check className="h-3.5 w-3.5 mr-1" />
                    Remove from score
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleResolve(d.id, "rejected")}
                    disabled={processing === d.id}
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    Keep event
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {resolved.length > 0 && (
          <details className="pt-4">
            <summary className="text-sm text-muted-foreground cursor-pointer">Resolved disputes ({resolved.length})</summary>
            <div className="space-y-2 mt-2">
              {resolved.map((d: any) => (
                <div key={d.id} className="text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg flex justify-between">
                  <span>{d.dispute_type} — {events?.[d.event_id]?.title || d.event_id}</span>
                  <Badge variant="outline" className="text-[10px]">{d.status}</Badge>
                </div>
              ))}
            </div>
          </details>
        )}
      </main>
    </div>
  );
}
