import { ScanLine, Building2, Users, TrendingUp } from "lucide-react";

export function HowItWorks() {
  return (
    <section className="py-12 px-4 bg-muted/30 rounded-2xl">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">How It Works</h2>
          <p className="text-sm text-muted-foreground">
            Discover the real story behind what you buy
          </p>
        </div>

        <ul className="grid md:grid-cols-4 gap-4 text-sm">
          <li className="flex flex-col items-center text-center gap-2 p-4 bg-card rounded-xl border">
            <ScanLine className="h-8 w-8 text-primary" />
            <div>
              <div className="font-semibold mb-1">Scan or Search</div>
              <div className="text-xs text-muted-foreground">Find any brand by barcode or name</div>
            </div>
          </li>
          <li className="flex flex-col items-center text-center gap-2 p-4 bg-card rounded-xl border">
            <Building2 className="h-8 w-8 text-primary" />
            <div>
              <div className="font-semibold mb-1">See Real Owners</div>
              <div className="text-xs text-muted-foreground">Trace ownership to parent companies</div>
            </div>
          </li>
          <li className="flex flex-col items-center text-center gap-2 p-4 bg-card rounded-xl border">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <div className="font-semibold mb-1">Know Who Profits</div>
              <div className="text-xs text-muted-foreground">View executives, founders & shareholders</div>
            </div>
          </li>
          <li className="flex flex-col items-center text-center gap-2 p-4 bg-card rounded-xl border">
            <TrendingUp className="h-8 w-8 text-primary" />
            <div>
              <div className="font-semibold mb-1">Stay Informed</div>
              <div className="text-xs text-muted-foreground">Track trending brands & new data</div>
            </div>
          </li>
        </ul>
      </div>
    </section>
  );
}
