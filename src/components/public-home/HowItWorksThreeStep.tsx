import { ScanLine, FileSearch, ArrowRightLeft } from "lucide-react";

const STEPS = [
  {
    icon: ScanLine,
    title: "Scan",
    body: "Scan a supported retail barcode, or search a product or brand by name.",
  },
  {
    icon: FileSearch,
    title: "See the reasons",
    body: "Check the recorded ownership and available evidence. Look for missing information and source dates.",
  },
  {
    icon: ArrowRightLeft,
    title: "Compare alternatives",
    body: "Explore alternatives where enough category and ownership information is available.",
  },
];

export function HowItWorksThreeStep() {
  return (
    <section className="py-10">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-[3px] text-muted-foreground font-medium mb-2">How it works</p>
          <h2 className="font-display font-bold text-2xl sm:text-3xl text-foreground">
            From the label to the company.
          </h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-6">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={s.title} className="text-center space-y-3">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Step {i + 1}
                </p>
                <h3 className="font-semibold text-base text-foreground">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
