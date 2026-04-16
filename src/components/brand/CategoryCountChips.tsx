import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CategoryCountChipsProps {
  brandId: string;
  totalEvents: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  labor: "Labor",
  environment: "Environment",
  politics: "Politics",
  social: "Social",
};

const CATEGORY_ORDER = ["labor", "environment", "politics", "social"];

/**
 * Renders per-category event counts inline so users can verify
 * "N records across M categories" matches what's actually shown.
 * Audit fix: previously only the dominant category was visible, which
 * read like a data mismatch.
 */
export function CategoryCountChips({ brandId, totalEvents }: CategoryCountChipsProps) {
  const { data } = useQuery({
    queryKey: ["category-counts", brandId],
    queryFn: async () => {
      const { data: events } = await supabase
        .from("brand_events")
        .select("category")
        .eq("brand_id", brandId)
        .eq("is_irrelevant", false)
        .limit(1000);
      const counts: Record<string, number> = {};
      (events || []).forEach((e: any) => {
        const c = e.category;
        if (c) counts[c] = (counts[c] || 0) + 1;
      });
      return counts;
    },
    enabled: !!brandId,
  });

  const counts = data || {};
  const present = CATEGORY_ORDER.filter((c) => (counts[c] || 0) > 0);

  return (
    <div className="space-y-1.5 text-center">
      <p className="text-xs text-muted-foreground">
        Based on {totalEvents} public record{totalEvents !== 1 ? "s" : ""} across {present.length} categor{present.length !== 1 ? "ies" : "y"}
      </p>
      {present.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {CATEGORY_ORDER.map((cat) => {
            const n = counts[cat] || 0;
            return (
              <span
                key={cat}
                className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                  n > 0
                    ? "border-border bg-elevated-2 text-foreground"
                    : "border-border/40 bg-transparent text-muted-foreground/50"
                }`}
              >
                {CATEGORY_LABELS[cat]} {n}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
