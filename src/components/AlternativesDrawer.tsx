import { useState } from "react";
import { ChevronRight, TrendingUp } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDelta, getScoreDelta, getValueFitLabel, getTopContributors, type BrandScores, getUserWeights } from "@/lib/valueFit";

interface Alternative {
  brand_id: string;
  brand_name: string;
  valueFit: number;
  overall_score: number;
  why: string;
  price_context?: string;
  scores: BrandScores;
}

interface AlternativesDrawerProps {
  alternatives: Alternative[];
  currentScore: number;
  currentScores: BrandScores;
  onCompare: (brandId: string) => void;
}

export function AlternativesDrawer({ alternatives, currentScore, currentScores, onCompare }: AlternativesDrawerProps) {
  const [open, setOpen] = useState(false);
  const weights = getUserWeights();

  if (!alternatives.length) {
    return (
      <Button variant="outline" disabled className="w-full">
        No alternatives available
      </Button>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="w-full">
          <TrendingUp className="h-4 w-4 mr-2" />
          Better options ({alternatives.length})
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[80vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Better Alternatives</SheetTitle>
          <SheetDescription>
            Brands in the same product category, ranked by your values and priorities
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-6 space-y-3">
          {alternatives.map((alt) => {
            const delta = getScoreDelta(currentScore, alt.valueFit);
            const fit = getValueFitLabel(alt.valueFit);
            const why = getTopContributors(currentScores, alt.scores, weights);
            
            return (
              <div
                key={alt.brand_id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-base">{alt.brand_name}</h4>
                      {delta > 0 && (
                        <Badge variant="outline" className="mt-1 bg-success/10 text-success border-success/20">
                          {formatDelta(delta)} better for you
                        </Badge>
                      )}
                    </div>
                    <div className="text-right">
                      <div className={`text-xl font-bold ${fit.color}`}>
                        {alt.valueFit}
                      </div>
                      <div className="text-xs text-[var(--muted)]">/100</div>
                    </div>
                  </div>
                  
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {why}
                  </p>
                  
                  {alt.price_context && (
                    <p className="text-xs text-[var(--muted)]">
                      <span className="font-medium">Price:</span> {alt.price_context}
                    </p>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      onCompare(alt.brand_id);
                      setOpen(false);
                    }}
                  >
                    Compare
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
