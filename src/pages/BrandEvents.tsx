import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ExternalLink, Flag } from "lucide-react";
import { DisputeForm } from "@/components/brand/DisputeForm";
import { EventVoteButtons } from "@/components/brand/EventVoteButtons";

type Filter = "all" | "scored" | "excluded";
type DimFilter = "all" | "labor" | "environment" | "politics" | "social";

interface EventRow {
  event_id: string;
  title: string | null;
  event_date: string;
  category: string;
  source_url: string | null;
  score_eligible: boolean | null;
  score_excluded_reason: string | null;
  decay_multiplier: number | null;
  weighted_impact_score: number | null;
  impact_labor: number | null;
  impact_environment: number | null;
  impact_social: number | null;
  impact_politics: number | null;
  disputed: boolean | null;
  upvotes: number | null;
  downvotes: number | null;
}

function getDomain(url: string | null) {
  if (!url) return null;
  try { return new URL(url).hostname.replace("www.", ""); } catch { return null; }
}

function getImpact(e: EventRow) {
  return (e.impact_labor || 0) + (e.impact_environment || 0) + (e.impact_social || 0) + (e.impact_politics || 0);
}

function getDimension(e: EventRow): string {
  const dims = [
    { key: "labor", val: Math.abs(e.impact_labor || 0) },
    { key: "environment", val: Math.abs(e.impact_environment || 0) },
    { key: "social", val: Math.abs(e.impact_social || 0) },
    { key: "politics", val: Math.abs(e.impact_politics || 0) },
  ];
  const top = dims.sort((a, b) => b.val - a.val)[0];
  return top.val > 0 ? top.key : e.category || "—";
}

export default function BrandEvents() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");
  const [dimFilter, setDimFilter] = useState<DimFilter>("all");
  const [disputingId, setDisputingId] = useState<string | null>(null);

  const { data: brand } = useQuery({
    queryKey: ["brand-name", id],
    queryFn: async () => {
      const { data } = await supabase.from("brands").select("id, name, slug").eq("id", id!).maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  const { data: events, isLoading } = useQuery({
    queryKey: ["brand-all-events", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("brand_events")
        .select("event_id, title, event_date, category, source_url, score_eligible, score_excluded_reason, decay_multiplier, weighted_impact_score, impact_labor, impact_environment, impact_social, impact_politics, disputed, upvotes, downvotes")
        .eq("brand_id", id!)
        .eq("is_irrelevant", false)
        .order("event_date", { ascending: false })
        .limit(200);
      return (data || []) as EventRow[];
    },
    enabled: !!id,
  });

  const filtered = (events || []).filter(e => {
    if (filter === "scored" && (!e.score_eligible || e.score_excluded_reason)) return false;
    if (filter === "excluded" && e.score_eligible && !e.score_excluded_reason) return false;
    if (dimFilter !== "all") {
      const dim = getDimension(e);
      if (dim !== dimFilter) return false;
    }
    return true;
  });

  const scored = (events || []).filter(e => e.score_eligible && !e.score_excluded_reason).length;
  const excludedCount = (events || []).filter(e => !e.score_eligible || e.score_excluded_reason).length;

  return (
    <div className="min-h-screen bg-background">
      <main className="container max-w-2xl mx-auto px-4 py-6 space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>

        <div>
          <h1 className="text-xl font-bold">{brand?.name || "Brand"} — Event Ledger</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Full audit trail: every event we found, whether it's scored or excluded, and why.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {([["all", `All (${events?.length || 0})`], ["scored", `Scored (${scored})`], ["excluded", `Excluded (${excludedCount})`]] as const).map(([key, label]) => (
            <Button
              key={key}
              variant={filter === key ? "default" : "outline"}
              size="sm"
              className="text-xs"
              onClick={() => setFilter(key)}
            >
              {label}
            </Button>
          ))}
          <span className="border-l border-border mx-1" />
          {(["all", "labor", "environment", "politics", "social"] as const).map(dim => (
            <Button
              key={dim}
              variant={dimFilter === dim ? "secondary" : "ghost"}
              size="sm"
              className="text-xs capitalize"
              onClick={() => setDimFilter(dim)}
            >
              {dim === "all" ? "All dims" : dim}
            </Button>
          ))}
        </div>

        {/* Event list */}
        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Loading events…</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No events match this filter.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map(ev => {
              const impact = getImpact(ev);
              const isExcluded = !ev.score_eligible || !!ev.score_excluded_reason;
              const domain = getDomain(ev.source_url);
              const decay = ev.decay_multiplier ?? 1.0;

              return (
                <Card key={ev.event_id} className={isExcluded ? "opacity-60" : ""}>
                  <CardContent className="py-3 px-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium leading-snug">{ev.title || "Untitled"}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                          <span>{new Date(ev.event_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                          {domain && ev.source_url && (
                            <a href={ev.source_url} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                              {domain} <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                          <Badge variant="outline" className="text-[10px] capitalize">{getDimension(ev)}</Badge>
                        </div>
                      </div>
                      <div className="text-right shrink-0 space-y-1">
                        {isExcluded ? (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            {ev.score_excluded_reason || "Excluded"}
                          </Badge>
                        ) : (
                          <>
                            <span className={`text-sm font-mono font-bold ${impact >= 0 ? "text-success" : "text-destructive"}`}>
                              {impact >= 0 ? "+" : ""}{impact.toFixed(1)}
                            </span>
                            {decay < 1.0 && (
                              <p className="text-[10px] text-muted-foreground">{decay.toFixed(1)}×</p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    
                    {ev.disputed && (
                      <Badge variant="outline" className="text-[10px] text-warning border-warning/30">Under review</Badge>
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <EventVoteButtons
                        eventId={ev.event_id}
                        upvotes={ev.upvotes ?? 0}
                        downvotes={ev.downvotes ?? 0}
                      />
                      {disputingId === ev.event_id ? (
                        <DisputeForm
                          eventId={ev.event_id}
                          brandId={id!}
                          eventTitle={ev.title}
                          onClose={() => setDisputingId(null)}
                        />
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-muted-foreground h-6 px-2"
                          onClick={() => setDisputingId(ev.event_id)}
                        >
                          <Flag className="h-3 w-3 mr-1" /> Dispute
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <p className="text-xs text-center text-muted-foreground pt-4">
          <a href="/methodology" className="text-primary hover:underline">How scoring works →</a>
        </p>
      </main>
    </div>
  );
}
