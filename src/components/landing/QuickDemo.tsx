import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
      <Card className="overflow-hidden border-border/50 bg-card/50 backdrop-blur">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-border/50">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ScanLine className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Quick demo</span>
            </div>
            <p className="text-xs text-muted-foreground">
              This is the exact "scan → reveal" moment, without needing a camera.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={() => navigate("/scan")}
          >
            <ScanLine className="mr-2 h-4 w-4" />
            Scan your own
          </Button>
        </div>

        {/* Content */}
        <div className="grid md:grid-cols-[280px,1fr] divide-y md:divide-y-0 md:divide-x divide-border/50">
          {/* Product selector */}
          <div className="p-4 space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Pick an example
            </h3>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <button
                  key={idx}
                  onClick={() => setActive(idx)}
                  className={cn(
                    "w-full text-left rounded-lg border px-3 py-2 transition",
                    idx === active
                      ? "border-primary/40 bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{it.product}</p>
                      <p className="text-xs text-muted-foreground">
                        {it.barcode} • {it.brand}
                      </p>
                    </div>
                    <ArrowRight className={cn(
                      "h-4 w-4 transition-opacity",
                      idx === active ? "opacity-100 text-primary" : "opacity-0"
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
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Scan result</p>
                <p className="text-lg font-semibold text-foreground">{current.product}</p>
                <p className="text-xs text-muted-foreground">
                  Barcode: {current.barcode}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs"
                onClick={() => navigate(`/unknown/${current.barcode}`)}
              >
                Try unknown flow
              </Button>
            </div>

            {/* Ownership chain */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Ownership chain</p>
              <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex flex-wrap items-center gap-2">
                  {current.ownerChain.map((node, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-md bg-card border border-border text-sm font-medium text-foreground">
                        {node}
                      </span>
                      {i !== current.ownerChain.length - 1 && (
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
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
      </Card>
    </section>
  );
}
