import { ScanLine, FileSearch, Sliders } from "lucide-react";

export function HowItWorks() {
  const steps = [
    {
      icon: ScanLine,
      label: "SCAN",
      title: "Scan Any Product",
      description: "Use your camera or enter a barcode to identify the brand behind any product.",
    },
    {
      icon: FileSearch,
      label: "AUDIT",
      title: "Forensic Analysis",
      description: "We cross-reference verified news, government records, and public filings.",
    },
    {
      icon: Sliders,
      label: "ALIGN",
      title: "Personal Alignment",
      description: "See how a brand's record matches your own values and priorities.",
    },
  ];

  return (
    <section className="py-10">
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">THE FORENSIC PROCESS</h2>
          <p className="text-lg font-semibold text-foreground">How It Works</p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-3 gap-4">
          {steps.map((step, i) => (
            <div key={step.label} className="bg-elevated-1 border border-border p-4 space-y-3 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary mx-auto">
                <step.icon className="h-6 w-6" />
              </div>
              <div className="font-mono text-xs uppercase tracking-widest text-primary font-semibold">
                {String(i + 1).padStart(2, '0')}. {step.label}
              </div>
              <div>
                <div className="font-semibold text-sm mb-1">{step.title}</div>
                <div className="text-xs text-muted-foreground leading-relaxed">
                  {step.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
