import { ShieldCheck, ShieldAlert, ShieldX, Clock, FileCheck } from "lucide-react";

export interface TrustVerdictProps {
  score: number | null;
  brandName: string;
  reasons: string[];
  hasEvidence?: boolean;
  category?: string | null;
  parentCompany?: string | null;
  website?: string | null;
  profileSummary?: string | null;
  profileCompleteness?: number | null;
  eventCount?: number;
}

type Verdict = {
  label: string;
  icon: typeof ShieldCheck;
  className: string;
  bgClassName: string;
};

function getVerdict(score: number | null, hasEvidence?: boolean): Verdict {
  if (score === null) return {
    label: hasEvidence ? "Analyzing" : "Score in progress",
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

function buildFallbackInsights(brandName: string, category?: string | null, parentCompany?: string | null, hasEvidence?: boolean, website?: string | null): string[] {
  const insights: string[] = [];
  
  if (parentCompany && parentCompany !== brandName) {
    insights.push(`Owned by ${parentCompany} — reviewing parent company record`);
  }
  
  if (hasEvidence) {
    insights.push("Found relevant data — verifying sources now");
  }
  
  // Category-specific agency checks
  if (category) {
    const cat = category.toLowerCase();
    if (cat.includes('food') || cat.includes('snack') || cat.includes('beverage') || cat.includes('cereal')) {
      insights.push("Checking FDA records and supply chain reports");
    } else if (cat.includes('clean') || cat.includes('household') || cat.includes('detergent')) {
      insights.push("Reviewing EPA compliance and safety data");
    } else if (cat.includes('beauty') || cat.includes('personal care') || cat.includes('hygiene') || cat.includes('skin')) {
      insights.push("Checking ingredient safety and labor practices");
    } else {
      insights.push("Searching regulatory databases and public records");
    }
  } else {
    insights.push("Searching public records and regulatory databases");
  }
  
  if (insights.length < 2) {
    insights.push("No major issues found yet — verification in progress");
  }
  
  return insights.slice(0, 3);
}

export function TrustVerdict({ score, brandName, reasons, hasEvidence, category, parentCompany, website, profileSummary, profileCompleteness }: TrustVerdictProps) {
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

      {/* Enriched context for unscored brands */}
      {isAnalyzing && (
        <div className="space-y-2 pt-2 border-t border-border/50">
          {profileSummary && (
            <p className="text-xs text-foreground/70 leading-relaxed">{profileSummary}</p>
          )}
          {parentCompany && parentCompany !== brandName && !profileSummary && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="font-medium text-foreground/70">Parent company:</span> {parentCompany}
            </p>
          )}
          {website && !profileSummary && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="font-medium text-foreground/70">Website:</span> {website.replace(/^https?:\/\/(www\.)?/, '')}
            </p>
          )}
          {profileCompleteness != null && profileCompleteness > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
                <div className="h-full bg-primary/50 rounded-full transition-all" style={{ width: `${Math.min(profileCompleteness, 100)}%` }} />
              </div>
              <span className="text-[10px] text-muted-foreground">{profileCompleteness}% researched</span>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <FileCheck className="h-3 w-3" />
            Profile building — this updates automatically as we verify sources
          </p>
        </div>
      )}
    </div>
  );
}
