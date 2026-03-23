import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowRight, ScanLine } from "lucide-react";
import { useNavigate } from "react-router-dom";

type DemoItem = {
  product: string;
  barcode: string;
  brand: string;
  ownerChain: string[];
  note: string;
};

export function QuickDemo({ className }: { className?: string }) {
  const navigate = useNavigate();

  const items: DemoItem[] = useMemo(
    () => [
      {
        product: "Cereal (example)",
        barcode: "038000000000",
        brand: "Example Brand",
        ownerChain: ["Example Brand", "Parent Company", "Holding Group"],
        note: "Ownership chains often surprise people — even when the label looks 'independent'.",
      },
      {
        product: "Sparkling water (example)",
        barcode: "049000000000",
        brand: "Example Brand 2",
        ownerChain: ["Example Brand 2", "Global Beverage Co."],
        note: "You'll see who profits, plus verified events tied to the owner and subsidiaries.",
      },
      {
        product: "Chocolate (example)",
        barcode: "041000000000",
        brand: "Example Brand 3",
        ownerChain: ["Example Brand 3", "Food Conglomerate"],
        note: "Scan anything — if we don't have it yet, you can add it in under 30 seconds.",
      },
    ],
    []
  );

  const [active, setActive] = useState(0);
  const current = items[active];

  return (
    <section className={cn("w-full", className)}>
      <div className="bg-card border border-border/10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-border/10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ScanLine className="h-4 w-4 text-accent" />
              <span className="font-display font-semibold text-sm text-foreground">Quick Demo</span>
            </div>
            <p className="label-forensic">
              Simulated scan → reveal sequence
            </p>
          </div>
          <Button
            size="sm"
            className="bg-elevated-2 hover:bg-elevated-3 text-primary font-mono text-[10px] uppercase tracking-wider border border-border/20 h-8"
            onClick={() => navigate("/scan")}
          >
            <ScanLine className="mr-1.5 h-3 w-3" />
            Scan Your Own
          </Button>
        </div>

        {/* Content */}
        <div className="grid md:grid-cols-[280px,1fr]">
          {/* Product selector */}
          <div className="p-4 space-y-3 bg-background/50 border-r border-border/10 md:border-b-0 border-b">
            <h3 className="label-forensic">Select Subject</h3>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <button
                  key={idx}
                  onClick={() => setActive(idx)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 transition-all border",
                    idx === active
                      ? "border-accent/30 bg-elevated-2"
                      : "border-border/10 bg-card hover:bg-elevated-2/50"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{it.product}</p>
                      <p className="font-mono text-[10px] text-muted-foreground tracking-wide">
                        {it.barcode} • {it.brand}
                      </p>
                    </div>
                    <ArrowRight className={cn(
                      "h-3.5 w-3.5 transition-opacity text-accent",
                      idx === active ? "opacity-100" : "opacity-0"
                    )} />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Result display */}
          <div className="p-4 space-y-4">
            {/* Scan result header */}
            <div className="flex items-center justify-between">
              <div>
                <p className="label-forensic">Scan Result</p>
                <p className="text-lg font-display font-bold text-foreground mt-1">{current.product}</p>
                <p className="font-mono text-[10px] text-muted-foreground tracking-wide mt-0.5">
                  UPC: {current.barcode}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-accent"
                onClick={() => navigate(`/unknown/${current.barcode}`)}
              >
                Try Unknown Flow
              </Button>
            </div>

            {/* Ownership chain */}
            <div className="space-y-2">
              <p className="label-forensic">Ownership Chain</p>
              <div className="p-3 bg-background/50 border border-border/10">
                <div className="flex flex-wrap items-center gap-2">
                  {current.ownerChain.map((node, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-elevated-2 border border-border/20 text-sm font-medium text-foreground font-mono">
                        {node}
                      </span>
                      {i !== current.ownerChain.length - 1 && (
                        <ArrowRight className="h-3 w-3 text-accent/50" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground italic">
                {current.note}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
