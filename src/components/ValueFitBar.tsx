import { Progress } from "@/components/ui/progress";
import { getValueFitLabel } from "@/lib/valueFit";

interface ValueFitBarProps {
  score: number;
  showLabel?: boolean;
}

export function ValueFitBar({ score, showLabel = true }: ValueFitBarProps) {
  const fit = getValueFitLabel(score);

  return (
    <div className="space-y-2">
      {showLabel && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Value Fit</span>
          <span className={`text-sm font-semibold ${fit.color}`}>
            {fit.icon} {fit.label}
          </span>
        </div>
      )}
      <Progress value={score} className="h-2" />
      <div className="flex justify-between text-xs text-[var(--muted)]">
        <span>0</span>
        <span className="font-medium">{score}</span>
        <span>100</span>
      </div>
    </div>
  );
}
