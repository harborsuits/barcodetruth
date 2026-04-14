import { ScanLine, Search, ThumbsUp } from "lucide-react";

export function HowItWorks() {
  const steps = [
    { icon: ScanLine, label: "Scan" },
    { icon: Search, label: "We check" },
    { icon: ThumbsUp, label: "You decide" },
  ];

  return (
    <div className="flex items-center justify-center gap-6">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center gap-2">
          {i > 0 && <span className="text-muted-foreground/30 text-lg mr-2">→</span>}
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <step.icon className="h-4 w-4 text-primary" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">{step.label}</span>
        </div>
      ))}
    </div>
  );
}
