import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";

const EXAMPLES = [
  {
    name: "Tony's Chocolonely",
    parent: "Independent (B Corp)",
    score: 82,
    verdict: "Good",
    icon: ShieldCheck,
    color: "success",
    reasons: ["Public slavery-free supply chain audit", "B Corp certified", "Transparent cocoa sourcing"],
  },
  {
    name: "Coca-Cola Classic",
    parent: "The Coca-Cola Company",
    score: 48,
    verdict: "Mixed",
    icon: ShieldAlert,
    color: "warning",
    reasons: ["Plastic pollution lawsuits (2023–24)", "Strong recycling commitments", "$5M+ federal lobbying"],
  },
  {
    name: "Nestlé Pure Life",
    parent: "Nestlé S.A.",
    score: 28,
    verdict: "Avoid",
    icon: ShieldX,
    color: "destructive",
    reasons: ["Multiple water-rights disputes", "Child labor lawsuits in cocoa", "Repeated FDA recalls"],
  },
];

export function ExampleStrip() {
  return (
    <section className="py-10">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-[3px] text-muted-foreground font-medium mb-2">
            What a scan returns
          </p>
          <h2 className="font-display font-bold text-2xl sm:text-3xl text-foreground">
            One product. One verdict. The receipts.
          </h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {EXAMPLES.map((ex) => {
            const Icon = ex.icon;
            const colorClass =
              ex.color === "success" ? "text-success" :
              ex.color === "warning" ? "text-warning" : "text-destructive";
            const bgClass =
              ex.color === "success" ? "bg-success/10" :
              ex.color === "warning" ? "bg-warning/10" : "bg-destructive/10";
            return (
              <div key={ex.name} className={`${bgClass} border border-border rounded-lg p-4 space-y-3`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{ex.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{ex.parent}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-2xl font-extrabold tracking-tighter ${colorClass}`}>{ex.score}</span>
                    <span className="text-xs text-muted-foreground">/100</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${colorClass}`} />
                  <span className={`text-sm font-bold ${colorClass}`}>{ex.verdict}</span>
                </div>
                <ul className="space-y-1 pt-1 border-t border-border/40">
                  {ex.reasons.map((r) => (
                    <li key={r} className="text-xs text-foreground/75 leading-snug flex gap-1.5">
                      <span className="text-muted-foreground">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        <p className="text-center text-xs text-muted-foreground mt-4">
          Sample outputs. Real results pulled live from regulatory filings, news, and public records.
        </p>
      </div>
    </section>
  );
}
