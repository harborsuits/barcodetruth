import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { EventCard, type BrandEvent } from "@/components/EventCard";
import { formatDelta, getScoreDelta } from "@/lib/valueFit";

interface BrandData {
  brand_id: string;
  brand_name: string;
  valueFit: number;
  scores: {
    labor: number;
    environment: number;
    politics: number;
    social: number;
  };
  events: BrandEvent[];
}

interface CompareSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: BrandData;
  alternative: BrandData | null;
}

export function CompareSheet({ open, onOpenChange, current, alternative }: CompareSheetProps) {
  if (!alternative) return null;

  const categories = [
    { key: 'labor', label: 'Labor' },
    { key: 'environment', label: 'Environment' },
    { key: 'politics', label: 'Politics' },
    { key: 'social', label: 'Social' },
  ] as const;

  const valueFitDelta = getScoreDelta(current.valueFit, alternative.valueFit);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <SheetTitle>Compare Brands</SheetTitle>
              <SheetDescription>Side-by-side breakdown</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Header comparison */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <h3 className="font-semibold text-base">{current.brand_name}</h3>
              <div className="text-2xl font-bold text-[var(--muted)]">
                {current.valueFit}
              </div>
              <p className="text-xs text-[var(--muted)]">Current</p>
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-base">{alternative.brand_name}</h3>
              <div className="flex items-baseline gap-2">
                <div className="text-2xl font-bold text-[var(--success)]">
                  {alternative.valueFit}
                </div>
                {valueFitDelta > 0 && (
                  <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    {formatDelta(valueFitDelta)}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-[var(--muted)]">Alternative</p>
            </div>
          </div>

          {/* Category breakdown */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Category Breakdown</h4>
            {categories.map(({ key, label }) => {
              const currentScore = current.scores[key];
              const altScore = alternative.scores[key];
              const delta = getScoreDelta(currentScore, altScore);
              const deltaColor = delta > 0 ? "text-[var(--success)]" : delta < 0 ? "text-[var(--danger)]" : "text-[var(--muted)]";

              return (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{label}</span>
                    <span className={`text-xs font-semibold ${deltaColor}`}>
                      {delta !== 0 && formatDelta(delta)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Progress value={currentScore} className="h-1.5" />
                      <span className="text-xs text-[var(--muted)]">{currentScore}</span>
                    </div>
                    <div className="space-y-1">
                      <Progress value={altScore} className="h-1.5" />
                      <span className="text-xs text-[var(--muted)]">{altScore}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Trade-off summary */}
          <div className="p-4 rounded-lg bg-muted/30 border border-[var(--border)]">
            <h4 className="font-medium text-sm mb-2">Trade-off Summary</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {valueFitDelta > 0 ? (
                <>Switching to {alternative.brand_name} would improve your Value Fit by {valueFitDelta} points.</>
              ) : valueFitDelta < 0 ? (
                <>Switching to {alternative.brand_name} would lower your Value Fit by {Math.abs(valueFitDelta)} points.</>
              ) : (
                <>Both brands have similar Value Fit scores.</>
              )}
            </p>
          </div>

          {/* Recent events */}
          {alternative.events.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Recent Activity ({alternative.brand_name})</h4>
              {alternative.events.slice(0, 2).map((event) => (
                <EventCard key={event.event_id} event={event} compact />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
