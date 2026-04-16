import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildReasons } from "@/lib/buildReasons";

interface ReasonProofListProps {
  brandId: string;
  brandName: string;
  parentName?: string | null;
  scores: {
    score_labor?: number | null;
    score_environment?: number | null;
    score_politics?: number | null;
    score_social?: number | null;
    overall?: number | null;
  };
}

type ReasonWithProof = {
  label: string;
  example?: {
    title: string;
    date?: string;
  };
};

const CATEGORY_KEYWORDS: Record<string, string> = {
  labor: "labor",
  environment: "environment",
  politic: "politics",
  social: "social",
  parent: "",
  "No major": "",
  "Mixed record": "",
};

function matchCategory(reason: string): string | null {
  const r = reason.toLowerCase();
  if (r.includes("labor") || r.includes("workplace") || r.includes("osha")) return "labor";
  if (r.includes("environment") || r.includes("epa") || r.includes("emission")) return "environment";
  if (r.includes("politic") || r.includes("lobbying") || r.includes("donation")) return "politics";
  if (r.includes("social")) return "social";
  return null;
}

// Keyword filters per category — an event must contain at least one of these
// to be a believable proof anchor. Prevents "labor violations → merger headline" mismatches.
const CATEGORY_PROOF_KEYWORDS: Record<string, RegExp> = {
  labor: /\b(strike|union|wage|osha|workplace|labor|worker|fired|layoff|harass|discriminat|safety violation|injur|fatal)\b/i,
  environment: /\b(epa|pollut|emission|spill|contaminat|toxic|waste|climate|greenhouse|fine|cleanup|hazard|leak|chemical)\b/i,
  politics: /\b(lobby|donat|pac|election|campaign|fec|political|legisl|regulat)\b/i,
  social: /\b(boycott|controvers|protest|community|diversit|charit|donation|human rights)\b/i,
};

export function ReasonProofList({ brandId, brandName, parentName, scores }: ReasonProofListProps) {
  // Fetch evidence with enough detail to filter proof anchors per category
  const { data } = useQuery({
    queryKey: ["reason-proof", brandId],
    queryFn: async () => {
      const { data: events, error } = await supabase
        .from("brand_events")
        .select("category, title, description, event_date, source_url, score_eligible")
        .eq("brand_id", brandId)
        .eq("is_irrelevant", false)
        .order("event_date", { ascending: false })
        .limit(200);

      if (error || !events) return { counts: {}, examples: {} };

      const counts: Record<string, number> = {};
      const examples: Record<string, { title: string; date?: string }> = {};

      (events as any[]).forEach((e) => {
        const cat = e.category as string;
        if (!cat) return;
        counts[cat] = (counts[cat] || 0) + 1;

        // Only attach as proof if: score_eligible AND title/description matches category keywords
        if (examples[cat] || e.score_eligible === false) return;
        const text = `${e.title || ""} ${e.description || ""}`;
        const filter = CATEGORY_PROOF_KEYWORDS[cat];
        if (filter && !filter.test(text)) return;

        const title = e.title || (e.description?.slice(0, 80) + "…");
        const year = e.event_date ? new Date(e.event_date).getFullYear().toString() : undefined;
        examples[cat] = { title, date: year };
      });

      return { counts, examples };
    },
    enabled: !!brandId,
  });

  const counts = data?.counts || {};
  const examples = data?.examples || {};

  const reasons = buildReasons({
    scores,
    evidenceCounts: counts,
    parentName,
    brandName,
  });

  // Attach proof examples to reasons (only when the example is category-aligned)
  const items: ReasonWithProof[] = reasons.map((label) => {
    const cat = matchCategory(label);
    const example = cat ? examples[cat] : undefined;
    return { label, example };
  });

  if (items.length === 0) {
    return (
      <div className="space-y-1.5 pt-3 border-t border-border/50">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Assessment</p>
        <p className="text-sm text-muted-foreground">Mixed record across categories based on available data</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 pt-3 border-t border-border/50">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Why this score</p>
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="text-muted-foreground text-xs mt-0.5">•</span>
          <div className="min-w-0">
            <p className="text-sm leading-snug">{item.label}</p>
            {item.example ? (
              <p className="text-xs text-muted-foreground mt-0.5">
                → {item.example.title}{item.example.date ? ` (${item.example.date})` : ""}
              </p>
            ) : matchCategory(item.label) ? (
              <a
                href={`/brands/${brandId}/proof#${matchCategory(item.label)}`}
                className="text-xs text-primary hover:underline mt-0.5 inline-block"
              >
                → See full evidence
              </a>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
