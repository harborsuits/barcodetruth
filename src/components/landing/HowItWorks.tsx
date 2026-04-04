import { ScanLine, Search, ThumbsUp } from "lucide-react";

export function HowItWorks() {
  const steps = [
    {
      icon: ScanLine,
      step: "1",
      title: "Scan",
      description: "Point your camera at any barcode or search a brand by name.",
    },
    {
      icon: Search,
      step: "2",
      title: "We check",
      description: "We cross-reference public records, news, and regulatory data.",
    },
    {
      icon: ThumbsUp,
      step: "3",
      title: "You decide",
      description: "See a clear rating, top concerns, and better alternatives.",
    },
  ];

  return (
    <section className="py-10">
      <div className="space-y-6">
        <div className="space-y-1">
          <p className="text-lg font-semibold text-foreground">How It Works</p>
          <p className="text-sm text-muted-foreground">Three steps to know what you're buying</p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {steps.map((step) => (
            <div key={step.step} className="bg-elevated-1 border border-border p-4 space-y-3 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary mx-auto">
                <step.icon className="h-6 w-6" />
              </div>
              <div className="text-xs text-primary font-semibold uppercase tracking-wide">
                {step.step}. {step.title}
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed">
                {step.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
