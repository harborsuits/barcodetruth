import { ArrowRight, ShieldX, ShieldCheck } from "lucide-react";

export function AlternativesPreview() {
  return (
    <section className="py-10">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-[3px] text-muted-foreground font-medium mb-2">
            The payoff
          </p>
          <h2 className="font-display font-bold text-2xl sm:text-3xl text-foreground">
            Know what to buy instead.
          </h2>
        </div>

        <div className="grid sm:grid-cols-[1fr_auto_1fr] gap-4 items-stretch">
          <div className="bg-destructive/10 border border-border rounded-lg p-5 space-y-3">
            <p className="text-[10px] uppercase tracking-wider text-destructive font-bold">You scanned</p>
            <p className="font-semibold text-foreground">Hershey's Milk Chocolate</p>
            <div className="flex items-center gap-2">
              <ShieldX className="h-5 w-5 text-destructive" />
              <span className="font-bold text-destructive">Avoid · 31</span>
            </div>
            <p className="text-xs text-foreground/70 leading-snug">
              Multiple child-labor lawsuits in West African cocoa supply chain.
            </p>
          </div>

          <div className="hidden sm:flex items-center justify-center">
            <ArrowRight className="h-6 w-6 text-muted-foreground" />
          </div>

          <div className="bg-success/10 border border-border rounded-lg p-5 space-y-3">
            <p className="text-[10px] uppercase tracking-wider text-success font-bold">Better option</p>
            <p className="font-semibold text-foreground">Tony's Chocolonely</p>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-success" />
              <span className="font-bold text-success">Good · 82</span>
            </div>
            <p className="text-xs text-foreground/70 leading-snug">
              Public slavery-free audit, B Corp certified, transparent cocoa sourcing.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
