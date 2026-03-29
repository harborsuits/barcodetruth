import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";

interface TrustVerdictProps {
  score: number | null;
  brandName: string;
  reasons: string[];
  hasEvidence?: boolean;
}

type Verdict = {
  label: string;
  icon: typeof ShieldCheck;
  className: string;
  bgClassName: string;
};

function getVerdict(score: number | null, hasEvidence?: boolean): Verdict {
  if (score === null) return {
    label: hasEvidence ? "Analyzing" : "Unrated",
    icon: ShieldAlert,
    className: "text-muted-foreground",
    bgClassName: "bg-muted",
  };
  if (score >= 65) return {
    label: "Trust",
    icon: ShieldCheck,
    className: "text-success",
    bgClassName: "bg-success/10",
  };
  if (score >= 40) return {
    label: "Caution",
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

export function TrustVerdict({ score, brandName, reasons, hasEvidence }: TrustVerdictProps) {
  const verdict = getVerdict(score, hasEvidence);
  const Icon = verdict.icon;

  return (
    <div className={`${verdict.bgClassName} border border-border p-5 space-y-4`}>
      {/* Score + Verdict */}
      <div className="flex items-center justify-between">
        <div>
          <p className="label-forensic mb-1">Trust Score</p>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-5xl font-extrabold tracking-tighter ${verdict.className}`}
              style={{ fontFamily: "'Public Sans', sans-serif" }}
            >
              {score !== null ? Math.round(score) : "—"}
            </span>
            <span className="text-sm text-muted-foreground font-mono">/100</span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Icon className={`h-8 w-8 ${verdict.className}`} />
          <span className={`text-sm font-bold font-mono uppercase tracking-wider ${verdict.className}`}>
            {verdict.label}
          </span>
        </div>
      </div>

      {/* Top reasons */}
      {reasons.length > 0 && (
        <div className="space-y-1.5 pt-3 border-t border-border/50">
          <p className="label-forensic text-[10px]">Why</p>
          {reasons.slice(0, 3).map((reason, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-warning text-xs mt-0.5">⚠</span>
              <p className="text-sm text-foreground/80 leading-snug">{reason}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
