import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ExternalLink, ChevronDown, ChevronUp, Info } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { EventVoteButtons } from "./EventVoteButtons";
import { CommunityVoteSummary } from "./CommunityVoteSummary";

interface ScoreTransparencyProps {
  brandId: string;
  brandName: string;
}

interface ScoredEvent {
  event_id: string;
  title: string | null;
  event_date: string;
  category: string;
  source_url: string | null;
  ai_summary: string | null;
  decay_multiplier: number | null;
  weighted_impact_score: number | null;
  impact_labor: number | null;
  impact_environment: number | null;
  impact_social: number | null;
  impact_politics: number | null;
  score_excluded_reason: string | null;
  score_eligible: boolean | null;
  upvotes: number | null;
  downvotes: number | null;
}

function getSourceDomain(url: string | null): string | null {
  if (!url) return null;
  try { return new URL(url).hostname.replace("www.", ""); } catch { return null; }
}

function getEffectiveImpact(e: ScoredEvent): number {
  return (e.impact_labor || 0) + (e.impact_environment || 0) + (e.impact_social || 0) + (e.impact_politics || 0);
}

export function ScoreTransparency({ brandId, brandName }: ScoreTransparencyProps) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const { data: audit } = useQuery({
    queryKey: ["brand-score-audit", brandId],
    queryFn: async () => {
      const { data } = await supabase
        .from("brand_score_audit")
        .select("*")
        .eq("brand_id", brandId)
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!brandId,
  });

  const { data: events } = useQuery({
    queryKey: ["brand-scored-events", brandId],
    queryFn: async () => {
      const { data } = await supabase
        .from("brand_events")
        .select("event_id, title, event_date, category, source_url, ai_summary, decay_multiplier, weighted_impact_score, impact_labor, impact_environment, impact_social, impact_politics, score_excluded_reason, score_eligible")
        .eq("brand_id", brandId)
        .eq("is_irrelevant", false)
        .order("event_date", { ascending: false })
        .limit(50);
      return (data || []) as ScoredEvent[];
    },
    enabled: isOpen && !!brandId,
  });

  const scored = events?.filter(e => e.score_eligible && !e.score_excluded_reason) || [];
  const excluded = events?.filter(e => !e.score_eligible || e.score_excluded_reason) || [];

  const pulling_down = scored
    .filter(e => getEffectiveImpact(e) < 0)
    .sort((a, b) => getEffectiveImpact(a) - getEffectiveImpact(b))
    .slice(0, 3);

  const pulling_up = scored
    .filter(e => getEffectiveImpact(e) > 0)
    .sort((a, b) => getEffectiveImpact(b) - getEffectiveImpact(a))
    .slice(0, 3);

  const dateRange = scored.length > 0
    ? {
        from: new Date(scored[scored.length - 1].event_date).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        to: new Date(scored[0].event_date).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      }
    : null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between text-sm text-muted-foreground hover:text-foreground h-10 px-4"
        >
          <span className="flex items-center gap-2">
            <Info className="h-3.5 w-3.5" />
            How we scored this
          </span>
          {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="px-4 pb-4 space-y-4 text-sm">
          {/* Summary line */}
          <p className="text-muted-foreground">
            Based on <strong>{audit?.events_that_moved_score ?? scored.length}</strong> verified events
            {dateRange && <> · {dateRange.from} – {dateRange.to}</>}
            {audit && (
              <>
                {audit.events_considered !== audit.events_after_dedup && (
                  <> · {(audit.events_considered || 0) - (audit.events_after_dedup || 0)} duplicate stories removed</>
                )}
                {excluded.length > 0 && (
                  <> · {excluded.length} noise events excluded</>
                )}
              </>
            )}
          </p>

          {/* Pulling score down */}
          {pulling_down.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Pulling score down</p>
              {pulling_down.map(ev => (
                <EventRow key={ev.event_id} event={ev} />
              ))}
            </div>
          )}

          {/* Pulling score up */}
          {pulling_up.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Pulling score up</p>
              {pulling_up.map(ev => (
                <EventRow key={ev.event_id} event={ev} />
              ))}
            </div>
          )}

          {scored.length === 0 && (
            <p className="text-muted-foreground text-center py-4">No scored events yet — analysis in progress.</p>
          )}

          {/* Footer actions */}
          <div className="flex gap-2 pt-2 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              className="text-xs flex-1"
              onClick={() => navigate(`/brand/${brandId}/events`)}
            >
              See all {(scored.length + excluded.length) || ''} events →
            </Button>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function EventRow({ event }: { event: ScoredEvent }) {
  const impact = getEffectiveImpact(event);
  const domain = getSourceDomain(event.source_url);
  const decay = event.decay_multiplier ?? 1.0;
  const isPositive = impact > 0;

  return (
    <div className="pl-3 border-l-2 border-border space-y-1">
      <div className="flex items-start justify-between gap-2">
        <span className={`text-sm font-mono font-bold ${isPositive ? "text-success" : "text-destructive"}`}>
          {isPositive ? "+" : ""}{impact.toFixed(1)}
        </span>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {decay < 1.0 && `${decay.toFixed(1)}× weight`}
        </span>
      </div>
      <p className="text-sm font-medium leading-snug">{event.title || "Untitled event"}</p>
      {event.ai_summary && (
        <p className="text-xs text-muted-foreground leading-snug italic">"{event.ai_summary}"</p>
      )}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{new Date(event.event_date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
        {event.source_url && domain && (
          <a href={event.source_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
            {domain} <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{event.category}</Badge>
      </div>
    </div>
  );
}
