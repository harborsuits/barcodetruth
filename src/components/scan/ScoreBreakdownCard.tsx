import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

interface DimensionScore {
  key: string;
  label: string;
  score: number | null;
  evidenceCount: number;
  summary: string;
}

interface ScoreBreakdownCardProps {
  brandId: string;
  dimensions: DimensionScore[];
}

function getLetterGrade(score: number | null): { grade: string; className: string } {
  if (score === null) return { grade: "—", className: "text-muted-foreground" };
  if (score >= 85) return { grade: "A", className: "text-success" };
  if (score >= 75) return { grade: "B+", className: "text-success" };
  if (score >= 65) return { grade: "B", className: "text-success" };
  if (score >= 55) return { grade: "B-", className: "text-warning" };
  if (score >= 45) return { grade: "C", className: "text-warning" };
  if (score >= 35) return { grade: "C-", className: "text-warning" };
  if (score >= 25) return { grade: "D", className: "text-destructive" };
  return { grade: "F", className: "text-destructive" };
}

export function ScoreBreakdownCard({ brandId, dimensions }: ScoreBreakdownCardProps) {
  const allPending = dimensions.every(d => d.score === null);
  
  return (
    <div className="bg-elevated-1 border border-border divide-y divide-border">
      <div className="p-4">
        <h3 className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{allPending ? "What we're checking" : "Score Breakdown"}</h3>
      </div>

      {dimensions.map((dim) => {
        const { grade, className } = getLetterGrade(dim.score);
        const isPending = dim.score === null;
        return (
          <Link
            key={dim.key}
            to={`/brands/${brandId}/proof#${dim.key}`}
            className="flex items-center gap-3 p-4 hover:bg-elevated-2 transition-colors"
          >
            {/* Letter grade or pending indicator */}
            <div className={`w-10 h-10 flex items-center justify-center font-bold text-lg font-mono ${className}`}>
              {isPending ? (
                <span className="text-xs text-muted-foreground">···</span>
              ) : (
                grade
              )}
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{dim.label}</span>
                {dim.score !== null && (
                  <span className="text-xs text-muted-foreground font-mono">{Math.round(dim.score)}/100</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {isPending ? getPendingSummary(dim.key) : dim.summary}
              </p>
              {dim.evidenceCount > 0 && (
                <p className="text-[10px] text-muted-foreground font-mono mt-1">
                  {dim.evidenceCount} evidence item{dim.evidenceCount !== 1 ? "s" : ""}
                </p>
              )}
            </div>

            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </Link>
        );
      })}
    </div>
  );
}

function getPendingSummary(key: string): string {
  switch (key) {
    case "labor": return "Checking OSHA records, workplace safety reports";
    case "environment": return "Reviewing EPA filings, environmental compliance";
    case "politics": return "Scanning FEC donations, lobbying disclosures";
    default: return "Analyzing public records and news sources";
  }
}
