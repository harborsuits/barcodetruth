type ScoreKind = "labor" | "environment" | "politics" | "social";
const KINDS: ScoreKind[] = ["labor", "environment", "politics", "social"];

const LABELS: Record<ScoreKind, string> = {
  labor: "Labor",
  environment: "Environment",
  politics: "Politics",
  social: "Social"
};

export function ScoresGrid({ scores }: { scores?: Partial<Record<ScoreKind, number>> }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {KINDS.map((k) => {
        const v = Math.round(scores?.[k] ?? 50);
        return (
          <div key={k} className="rounded-2xl border p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {LABELS[k]}
            </div>
            <div className="text-2xl font-semibold">{v}</div>
            <div className="h-1 mt-2 rounded bg-muted">
              <div
                className="h-1 rounded bg-primary"
                style={{ width: `${v}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
