import { FileSearch, TrendingUp, Archive, ShieldCheck } from "lucide-react";

export function HowItWorks() {
  return (
    <section className="py-12 px-4 bg-muted/30 rounded-2xl">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">How This Works</h2>
          <p className="text-sm text-muted-foreground">
            Transparent scoring. Every change is cited.
          </p>
        </div>

        <ul className="grid md:grid-cols-4 gap-4 text-sm">
          <li className="flex flex-col items-center text-center gap-2 p-4 bg-card rounded-xl border">
            <FileSearch className="h-8 w-8 text-primary" />
            <div>
              <div className="font-semibold mb-1">Intake</div>
              <div className="text-xs text-muted-foreground">EPA · OSHA · FEC · GDELT</div>
            </div>
          </li>
          <li className="flex flex-col items-center text-center gap-2 p-4 bg-card rounded-xl border">
            <TrendingUp className="h-8 w-8 text-primary" />
            <div>
              <div className="font-semibold mb-1">Baselines</div>
              <div className="text-xs text-muted-foreground">24-month history</div>
            </div>
          </li>
          <li className="flex flex-col items-center text-center gap-2 p-4 bg-card rounded-xl border">
            <Archive className="h-8 w-8 text-primary" />
            <div>
              <div className="font-semibold mb-1">Evidence</div>
              <div className="text-xs text-muted-foreground">Sources archived on Wayback</div>
            </div>
          </li>
          <li className="flex flex-col items-center text-center gap-2 p-4 bg-card rounded-xl border">
            <ShieldCheck className="h-8 w-8 text-primary" />
            <div>
              <div className="font-semibold mb-1">Proof Gate</div>
              <div className="text-xs text-muted-foreground">Big moves need verified, independent outlets</div>
            </div>
          </li>
        </ul>
      </div>
    </section>
  );
}
