import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { HelpCircle, ChevronDown, ChevronUp, ShieldCheck, Filter, BarChart3, Signal, Clock } from "lucide-react";
import { useState } from "react";

interface WhyThisScoreProps {
  brandId: string;
  brandName: string;
  score: number | null;
  scoreDimensions?: {
    score_labor: number | null;
    score_environment: number | null;
    score_politics: number | null;
    score_social: number | null;
  };
}

interface FilterStats {
  totalEvents: number;
  eligibleEvents: number;
  excludedEvents: number;
  directBrandEvents: number;
  parentOnlyEvents: number;
  marketingNoiseEvents: number;
  duplicateEvents: number;
  categoryBreakdown: Record<string, number>;
  verificationBreakdown: Record<string, number>;
  topImpactDimensions: { dimension: string; avgImpact: number }[];
  recencyLabel: "Recent" | "Moderate" | "Older" | "Unknown";
  latestEventDate: string | null;
  recencyBullet: string;
}

const DIMENSION_LABELS: Record<string, string> = {
  labor: "Labor & Safety",
  environment: "Environment",
  politics: "Political Influence",
  social: "Social Impact",
};

function confidenceLabel(eventCount: number): { label: string; color: string; icon: string } {
  if (eventCount >= 20) return { label: "Strong data", color: "text-success", icon: "◉" };
  if (eventCount >= 5) return { label: "Moderate data", color: "text-warning", icon: "◉" };
  return { label: "Limited data", color: "text-muted-foreground", icon: "○" };
}

function buildDriverBullets(
  stats: FilterStats,
  score: number | null,
  dims?: WhyThisScoreProps["scoreDimensions"]
): string[] {
  const bullets: string[] = [];

  // Top impact dimensions
  if (stats.topImpactDimensions.length > 0) {
    const top = stats.topImpactDimensions[0];
    const label = DIMENSION_LABELS[top.dimension] || top.dimension;
    if (top.avgImpact < 0) {
      bullets.push(`${label} is the strongest negative driver`);
    } else if (top.avgImpact > 0) {
      bullets.push(`${label} is the strongest positive driver`);
    }
  }

  // Category composition
  const catEntries = Object.entries(stats.categoryBreakdown).sort((a, b) => b[1] - a[1]);
  if (catEntries.length > 0) {
    const topCats = catEntries.slice(0, 2);
    const parts = topCats.map(([cat, count]) => `${count} ${DIMENSION_LABELS[cat] || cat}`);
    bullets.push(`Key evidence: ${parts.join(", ")} event${stats.eligibleEvents !== 1 ? "s" : ""}`);
  }

  // Verification quality
  const officialCount = stats.verificationBreakdown["official"] || 0;
  const corroboratedCount = stats.verificationBreakdown["corroborated"] || 0;
  const verifiedTotal = officialCount + corroboratedCount;
  if (verifiedTotal > 0) {
    bullets.push(`${verifiedTotal} of ${stats.eligibleEvents} events are officially verified or corroborated`);
  }

  // Direct vs inherited
  if (stats.parentOnlyEvents > 0 && stats.directBrandEvents > 0) {
    bullets.push(`Score based on ${stats.directBrandEvents} direct brand events`);
  }

  // Dimension weaknesses
  if (dims) {
    const weakDims = (["labor", "environment", "politics", "social"] as const)
      .filter(d => {
        const val = dims[`score_${d}` as keyof typeof dims];
        return val !== null && val < 40;
      })
      .map(d => DIMENSION_LABELS[d]);
    if (weakDims.length > 0) {
      bullets.push(`Concerns in: ${weakDims.join(", ")}`);
    }
  }

  return bullets.slice(0, 4);
}

function buildExclusionBullets(stats: FilterStats): string[] {
  const bullets: string[] = [];
  if (stats.parentOnlyEvents > 0) {
    bullets.push(`${stats.parentOnlyEvents} parent-company-only event${stats.parentOnlyEvents !== 1 ? "s" : ""} excluded`);
  }
  if (stats.marketingNoiseEvents > 0) {
    bullets.push(`${stats.marketingNoiseEvents} marketing/PR event${stats.marketingNoiseEvents !== 1 ? "s" : ""} filtered`);
  }
  if (stats.duplicateEvents > 0) {
    bullets.push(`${stats.duplicateEvents} duplicate${stats.duplicateEvents !== 1 ? "s" : ""} suppressed`);
  }
  const otherExcluded = stats.excludedEvents - stats.parentOnlyEvents - stats.marketingNoiseEvents - stats.duplicateEvents;
  if (otherExcluded > 0) {
    bullets.push(`${otherExcluded} other irrelevant event${otherExcluded !== 1 ? "s" : ""} removed`);
  }
  return bullets;
}

export function WhyThisScore({ brandId, brandName, score, scoreDimensions }: WhyThisScoreProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ["why-this-score", brandId],
    enabled: !!brandId && isOpen, // lazy load on expand
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // Fetch all events for this brand to compute stats
      const { data: events, error } = await supabase
        .from("brand_events")
        .select("score_eligible, brand_relevance_score, is_marketing_noise, duplicate_of, category, verification, impact_labor, impact_environment, impact_politics, impact_social, is_irrelevant, event_date")
        .eq("brand_id", brandId)
        .eq("is_irrelevant", false);

      if (error || !events) return null;

      const result: FilterStats = {
        totalEvents: events.length,
        eligibleEvents: 0,
        excludedEvents: 0,
        directBrandEvents: 0,
        parentOnlyEvents: 0,
        marketingNoiseEvents: 0,
        duplicateEvents: 0,
        categoryBreakdown: {},
        verificationBreakdown: {},
        topImpactDimensions: [],
        recencyLabel: "Unknown",
        latestEventDate: null,
        recencyBullet: "",
      };

      const dimImpacts: Record<string, number[]> = {
        labor: [], environment: [], politics: [], social: [],
      };

      for (const ev of events as any[]) {
        if (ev.score_eligible) {
          result.eligibleEvents++;
          // Category
          if (ev.category) {
            result.categoryBreakdown[ev.category] = (result.categoryBreakdown[ev.category] || 0) + 1;
          }
          // Verification
          if (ev.verification) {
            result.verificationBreakdown[ev.verification] = (result.verificationBreakdown[ev.verification] || 0) + 1;
          }
          // Impacts
          if (ev.impact_labor) dimImpacts.labor.push(ev.impact_labor);
          if (ev.impact_environment) dimImpacts.environment.push(ev.impact_environment);
          if (ev.impact_politics) dimImpacts.politics.push(ev.impact_politics);
          if (ev.impact_social) dimImpacts.social.push(ev.impact_social);
        } else {
          result.excludedEvents++;
        }

        // Attribution breakdown
        const relScore = ev.brand_relevance_score ?? 3;
        if (relScore >= 2) {
          result.directBrandEvents++;
        } else if (relScore === 1) {
          result.parentOnlyEvents++;
        }
        if (ev.is_marketing_noise) result.marketingNoiseEvents++;
        if (ev.duplicate_of) result.duplicateEvents++;
      }

      // Top impact dimensions
      result.topImpactDimensions = Object.entries(dimImpacts)
        .filter(([_, vals]) => vals.length > 0)
        .map(([dim, vals]) => ({
          dimension: dim,
          avgImpact: vals.reduce((s, v) => s + v, 0) / vals.length,
        }))
        .sort((a, b) => Math.abs(b.avgImpact) - Math.abs(a.avgImpact));

      // Recency computation from eligible events
      const eligibleDates = (events as any[])
        .filter(ev => ev.score_eligible && ev.event_date)
        .map(ev => new Date(ev.event_date).getTime())
        .filter(t => !isNaN(t));

      if (eligibleDates.length > 0) {
        const latest = Math.max(...eligibleDates);
        const now = Date.now();
        const monthsAgo = (now - latest) / (1000 * 60 * 60 * 24 * 30);
        result.latestEventDate = new Date(latest).toISOString();

        if (monthsAgo <= 12) {
          result.recencyLabel = "Recent";
        } else if (monthsAgo <= 36) {
          result.recencyLabel = "Moderate";
        } else {
          result.recencyLabel = "Older";
        }

        // Build recency bullet combining recency + impact
        const hasHighImpact = result.topImpactDimensions.some(d => Math.abs(d.avgImpact) >= 3);
        const hasNegative = result.topImpactDimensions.some(d => d.avgImpact < -1);

        if (result.recencyLabel === "Recent" && hasHighImpact && hasNegative) {
          result.recencyBullet = "Recent high-impact issues detected";
        } else if (result.recencyLabel === "Recent" && hasNegative) {
          result.recencyBullet = "Recent moderate issues on record";
        } else if (result.recencyLabel === "Recent") {
          result.recencyBullet = "Recent activity — score reflects current behavior";
        } else if (result.recencyLabel === "Moderate") {
          result.recencyBullet = "Most evidence is 1–3 years old — no recent major incidents";
        } else {
          result.recencyBullet = "Evidence is mostly older — recent record is unclear";
        }
      }

      return result;
    },
  });

  if (score === null) return null;

  const conf = confidenceLabel(stats?.eligibleEvents ?? 0);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full flex items-center justify-between p-3 bg-elevated-1 border border-border rounded-lg text-sm hover:bg-muted/50 transition-colors">
        <span className="flex items-center gap-2 text-muted-foreground font-medium">
          <HelpCircle className="h-4 w-4" />
          Why this score?
        </span>
        {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </CollapsibleTrigger>

      <CollapsibleContent>
        {stats ? (
          <div className="mt-2 border border-border rounded-lg divide-y divide-border overflow-hidden">
            {/* 1. Score Drivers */}
            <div className="p-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <BarChart3 className="h-3 w-3" />
                Score drivers
              </p>
              {buildDriverBullets(stats, score, scoreDimensions).map((bullet, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-muted-foreground text-xs mt-0.5">•</span>
                  <p className="text-sm text-foreground/80 leading-snug">{bullet}</p>
                </div>
              ))}
            </div>

            {/* 2. Filtering summary */}
            {stats.excludedEvents > 0 && (
              <div className="p-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Filter className="h-3 w-3" />
                  What was filtered out
                </p>
                {buildExclusionBullets(stats).map((bullet, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-muted-foreground text-xs mt-0.5">×</span>
                    <p className="text-sm text-foreground/60 leading-snug">{bullet}</p>
                  </div>
                ))}
              </div>
            )}

            {/* 3. Recency + Data confidence */}
            <div className="p-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Signal className="h-3 w-3" />
                Data confidence
              </p>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${conf.color}`}>
                  {conf.icon} {conf.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  · {stats.eligibleEvents} verified event{stats.eligibleEvents !== 1 ? "s" : ""} included
                </span>
              </div>
              {stats.recencyLabel !== "Unknown" && (
                <div className="flex items-center gap-2">
                  <Clock className={`h-3.5 w-3.5 ${stats.recencyLabel === "Recent" ? "text-success" : stats.recencyLabel === "Moderate" ? "text-warning" : "text-muted-foreground"}`} />
                  <span className="text-sm text-foreground/80">{stats.recencyBullet}</span>
                </div>
              )}
              {stats.eligibleEvents < 5 && (
                <p className="text-xs text-muted-foreground">
                  Score may shift as more evidence is verified. We need at least 5 events for a confident rating.
                </p>
              )}
            </div>

            {/* 4. Integrity note */}
            <div className="p-3 bg-muted/30">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3 flex-shrink-0" />
                Only brand-relevant, verified events affect this score. Marketing, PR, and parent-company noise are excluded automatically.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-2 border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground animate-pulse">Loading score breakdown...</p>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
