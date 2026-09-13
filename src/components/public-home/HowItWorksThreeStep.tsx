import { ScanLine, FileSearch, ArrowRightLeft } from "lucide-react";

const STEPS = [
  {
    icon: ScanLine,
    title: "Find a product",
    body: "Search its name or scan the barcode on the package.",
  },
  {
    icon: FileSearch,
    title: "Choose a question",
    body: "Ingredients? Ownership? Company actions? Open what matters to you.",
  },
  {
    icon: ArrowRightLeft,
    title: "Decide what’s next",
    body: "Check another product, explore a local market, or save it for later.",
  },
];

export function HowItWorksThreeStep() {
  return (
    <section className="py-7 border-t border-border">
      <div className="max-w-4xl mx-auto">
        <h2 className="font-semibold text-lg mb-5">Three simple steps</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={s.title} className="space-y-2">
                <div className="flex gap-2 items-center text-teal-200">
                  <Icon className="h-4 w-4" /><span className="text-xs font-semibold">{i + 1}</span>
                </div>
                <h3 className="font-semibold text-base text-foreground">{s.title}</h3>
                <p className="text-sm text-slate-300 leading-relaxed">{s.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
