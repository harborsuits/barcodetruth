import { Link } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { getValueFitLabel, getUserWeights } from "@/lib/valueFit";

interface ValueFitBarProps {
  score: number;
  showLabel?: boolean;
  showExplainer?: boolean;
}

export function ValueFitBar({ score, showLabel = true, showExplainer = false }: ValueFitBarProps) {
  const fit = getValueFitLabel(score);
  const weights = getUserWeights();

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
      <Progress value={Math.min(100, Math.max(0, score))} className="h-2" />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>0</span>
        <span className="font-medium text-foreground">{score}</span>
        <span>100</span>
      </div>
      {showExplainer && (
        <p className="text-xs text-muted-foreground">
          Based on your priorities: Labor {Math.round(weights.labor * 100)}%, Environment {Math.round(weights.environment * 100)}%, Politics {Math.round(weights.politics * 100)}%, Social {Math.round(weights.social * 100)}%.{' '}
          <Link to="/settings" className="underline underline-offset-2 hover:no-underline">
            Adjust priorities
          </Link>
        </p>
      )}
    </div>
  );
}
