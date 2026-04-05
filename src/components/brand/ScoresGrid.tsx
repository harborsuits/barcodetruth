type ScoreKind = "labor" | "environment" | "politics" | "social";
const KINDS: ScoreKind[] = ["labor", "environment", "politics", "social"];

const LABELS: Record<ScoreKind, string> = {
  labor: "Labor",
  environment: "Environment",
  politics: "Politics",
  social: "Social"
};

export function ScoresGrid({ scores }: { scores?: Partial<Record<ScoreKind, number | null>> }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {KINDS.map((k) => {
        const raw = scores?.[k];
        const isNull = raw === null || raw === undefined;
        const v = isNull ? null : Math.round(raw);
        return (
          <div key={k} className="rounded-2xl border p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {LABELS[k]}
            </div>
            <div className="text-2xl font-semibold">
              {v !== null ? v : <span className="text-muted-foreground text-sm">Analyzing</span>}
            </div>
            <div className="h-1 mt-2 rounded bg-muted">
              {v !== null && (
                <div
                  className="h-1 rounded bg-primary"
                  style={{ width: `${v}%` }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
