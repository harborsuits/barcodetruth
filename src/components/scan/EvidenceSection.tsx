import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Newspaper, ExternalLink, Calendar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface EvidenceItem {
  event_id: string;
  description: string;
  category: string;
  event_date: string | null;
  source_url: string | null;
  source_name: string | null;
  verification: string | null;
}

interface EvidenceSectionProps {
  brandId: string;
  brandName: string;
  limit?: number;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

function categoryLabel(cat: string): string {
  const labels: Record<string, string> = {
    labor: "Labor & Safety",
    environment: "Environment",
    politics: "Political",
    social: "Social",
  };
  return labels[cat] || cat;
}

function categoryColor(cat: string): string {
  const colors: Record<string, string> = {
    labor: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    environment: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    politics: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    social: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  };
  return colors[cat] || "bg-muted text-muted-foreground";
}

export function EvidenceSection({ brandId, brandName, limit = 5 }: EvidenceSectionProps) {
  const { data: events, isLoading } = useQuery({
    queryKey: ["scan-evidence", brandId, limit],
    enabled: !!brandId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brand_events")
        .select("event_id, description, category, event_date, source_url, verification")
        .eq("brand_id", brandId)
        .eq("score_eligible", true)
        .order("event_date", { ascending: false })
        .limit(limit);

      if (error) {
        console.warn("[EvidenceSection] Query error:", error.message);
        return [];
      }
      return (data || []) as unknown as EvidenceItem[];
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!events || events.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1.5">
        <Newspaper className="h-3 w-3" />
        Recent evidence ({events.length})
      </p>
      <div className="space-y-2">
        {events.map((ev) => (
          <div
            key={ev.event_id}
            className="bg-elevated-1 border border-border rounded-lg p-3 space-y-1.5"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-foreground leading-snug flex-1">
                {ev.description}
              </p>
              {ev.source_url && (
                <a
                  href={ev.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground flex-shrink-0"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${categoryColor(ev.category)}`}>
                {categoryLabel(ev.category)}
              </span>
              {ev.event_date && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <Calendar className="h-2.5 w-2.5" />
                  {formatDate(ev.event_date)}
                </span>
              )}
              {ev.verification && ev.verification !== "unverified" && (
                <span className="text-[10px] text-muted-foreground">
                  ✓ {ev.verification}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
