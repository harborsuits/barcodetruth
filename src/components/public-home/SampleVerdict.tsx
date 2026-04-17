import { ShieldAlert, Building2, Globe, Signal, FileCheck } from "lucide-react";

export function SampleVerdict() {
  return (
    <section className="py-10">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-6">
          <p className="text-xs uppercase tracking-[3px] text-muted-foreground font-medium mb-2">
            Why this score?
          </p>
          <h2 className="font-display font-bold text-2xl sm:text-3xl text-foreground">
            Every verdict is inspectable.
          </h2>
        </div>

        <div className="bg-warning/10 border border-border rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
                Sample · Coca-Cola Classic
              </p>
              <div className="flex items-center gap-3">
                <ShieldAlert className="h-8 w-8 text-warning" />
                <span className="text-2xl font-bold text-warning">Mixed</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-3xl font-extrabold tracking-tighter text-foreground">48</span>
              <span className="text-sm text-muted-foreground ml-1">/100</span>
              <div className="mt-1 flex items-center justify-end gap-1.5">
                <Signal className="h-3 w-3 text-success" />
                <p className="text-[10px] text-muted-foreground">Strong data · 34 events</p>
              </div>
            </div>
          </div>

          <div className="space-y-1.5 pt-3 border-t border-border/50">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Top concerns</p>
            {[
              "Plastic pollution lawsuits filed in CA & NY (2023–24)",
              "$5.1M federal lobbying spend (2024) — beverage tax opposition",
              "Sugar-content health-marketing settlements",
            ].map((r) => (
              <div key={r} className="flex items-start gap-2">
                <span className="text-muted-foreground text-xs mt-0.5">•</span>
                <p className="text-sm text-foreground/80 leading-snug">{r}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-2 border-t border-border/50">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Building2 className="h-3 w-3" />
              <span className="font-medium text-foreground/70">Parent:</span> The Coca-Cola Company
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Globe className="h-3 w-3" />
              <span className="font-medium text-foreground/70">Site:</span> coca-colacompany.com
            </p>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-1">
              <FileCheck className="h-3 w-3" />
              Updated daily · Sources: SEC, FDA, Guardian, Reuters, NYT, federal lobbying disclosures
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
