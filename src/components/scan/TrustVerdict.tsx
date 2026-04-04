import { ShieldCheck, ShieldAlert, ShieldX, Clock, FileCheck } from "lucide-react";

interface TrustVerdictProps {
  score: number | null;
  brandName: string;
  reasons: string[];
  hasEvidence?: boolean;
  category?: string | null;
  parentCompany?: string | null;
  website?: string | null;
}

type Verdict = {
  label: string;
  icon: typeof ShieldCheck;
  className: string;
  bgClassName: string;
};

function getVerdict(score: number | null, hasEvidence?: boolean): Verdict {
  if (score === null) return {
    label: "Score coming soon",
    icon: Clock,
    className: "text-muted-foreground",
    bgClassName: "bg-muted",
  };
  if (score >= 65) return {
    label: "Good",
    icon: ShieldCheck,
    className: "text-success",
    bgClassName: "bg-success/10",
  };
  if (score >= 40) return {
    label: "Mixed",
    icon: ShieldAlert,
    className: "text-warning",
    bgClassName: "bg-warning/10",
  };
  return {
    label: "Avoid",
    icon: ShieldX,
    className: "text-destructive",
    bgClassName: "bg-destructive/10",
  };
}

function buildFallbackInsights(brandName: string, category?: string | null, parentCompany?: string | null, hasEvidence?: boolean): string[] {
  const insights: string[] = [];
  
  if (hasEvidence) {
    insights.push("We found data for this brand — analyzing it now");
  } else {
    insights.push("Checking public records and news sources");
  }
  
  if (parentCompany && parentCompany !== brandName) {
    insights.push(`Owned by ${parentCompany} — checking parent company too`);
  }
  
  if (category) {
    insights.push(`Comparing against other ${category.toLowerCase()} brands`);
  }
  
  if (insights.length < 2) {
    insights.push("No major issues found yet — analysis in progress");
  }
  
  return insights.slice(0, 3);
}

export function TrustVerdict({ score, brandName, reasons, hasEvidence, category, parentCompany, website }: TrustVerdictProps) {
  const verdict = getVerdict(score, hasEvidence);
  const Icon = verdict.icon;
  const isAnalyzing = score === null;

  const displayReasons = isAnalyzing && reasons.length <= 1
    ? buildFallbackInsights(brandName, category, parentCompany, hasEvidence)
    : reasons;

  return (
    <div className={`${verdict.bgClassName} border border-border rounded-lg p-5 space-y-4`}>
      {/* Score + Verdict */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Rating</p>
          <div className="flex items-center gap-3">
            <Icon className={`h-8 w-8 ${verdict.className}`} />
            <span className={`text-2xl font-bold ${verdict.className}`}>
              {verdict.label}
            </span>
          </div>
        </div>
        {score !== null && (
          <div className="text-right">
            <span className="text-3xl font-extrabold tracking-tighter text-foreground">
              {Math.round(score)}
            </span>
            <span className="text-sm text-muted-foreground ml-1">/100</span>
          </div>
        )}
      </div>

      {/* Top reasons */}
      {displayReasons.length > 0 && (
        <div className="space-y-1.5 pt-3 border-t border-border/50">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            {isAnalyzing ? "What we're checking" : "Top concerns"}
          </p>
          {displayReasons.slice(0, 3).map((reason, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-muted-foreground text-xs mt-0.5">•</span>
              <p className="text-sm text-foreground/80 leading-snug">{reason}</p>
            </div>
          ))}
        </div>
      )}

      {/* Auto-update message */}
      {isAnalyzing && (
        <p className="text-[11px] text-muted-foreground pt-1 flex items-center gap-1.5">
          <FileCheck className="h-3 w-3" />
          This will update automatically as we verify sources
        </p>
      )}
    </div>
  );
}
