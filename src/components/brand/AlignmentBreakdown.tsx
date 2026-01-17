import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  AlignmentResult, 
  AlignmentDriver, 
  getAlignmentColor, 
  getConfidenceColor,
  getDimensionEmoji 
} from "@/lib/alignmentScore";
import { TrendingUp, TrendingDown, Minus, Info, AlertTriangle } from "lucide-react";

interface AlignmentBreakdownProps {
  result: AlignmentResult;
  showConfidence?: boolean;
  compact?: boolean;
}

function ImpactIcon({ impact }: { impact: 'positive' | 'negative' | 'neutral' }) {
  switch (impact) {
    case 'positive':
      return <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />;
    case 'negative':
      return <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />;
    default:
      return <Minus className="h-4 w-4 text-muted-foreground" />;
  }
}

function DimensionBar({ driver }: { driver: AlignmentDriver }) {
  const barColor = driver.impact === 'positive' 
    ? 'bg-green-500' 
    : driver.impact === 'negative' 
      ? 'bg-red-500' 
      : 'bg-muted-foreground';
  
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span>{getDimensionEmoji(driver.dimension)}</span>
          <span className="font-medium">{driver.label}</span>
          <ImpactIcon impact={driver.impact} />
        </div>
        <div className="flex items-center gap-2">
          <span className={driver.impact === 'positive' ? 'text-green-600' : driver.impact === 'negative' ? 'text-red-600' : ''}>
            {Math.round(driver.brandScore)}
          </span>
          {driver.confidence === 'low' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Limited evidence for this dimension</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
      <div className="relative h-2 rounded bg-muted overflow-hidden">
        <div 
          className={`absolute h-full rounded transition-all ${barColor}`}
          style={{ width: `${driver.brandScore}%` }}
        />
        {/* User weight indicator */}
        <div 
          className="absolute top-0 h-full w-0.5 bg-foreground/50"
          style={{ left: `${driver.userWeightRaw}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Weight: {Math.round(driver.userWeight * 100)}%</span>
        <span>Contribution: {driver.contribution > 0 ? '+' : ''}{Math.round(driver.contribution)}</span>
      </div>
    </div>
  );
}

export function AlignmentBreakdown({ result, showConfidence = true, compact = false }: AlignmentBreakdownProps) {
  if (compact) {
    return (
      <div className="space-y-2">
        {result.drivers.map((driver) => (
          <div key={driver.dimension} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span>{getDimensionEmoji(driver.dimension)}</span>
              <span>{driver.label}</span>
            </div>
            <div className="flex items-center gap-1">
              <ImpactIcon impact={driver.impact} />
              <span className={`font-medium ${getAlignmentColor(driver.brandScore)}`}>
                {Math.round(driver.brandScore)}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Dealbreaker warning */}
      {result.dealbreaker.triggered && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800 dark:text-red-200">Dealbreaker</p>
            <p className="text-sm text-red-700 dark:text-red-300">{result.dealbreaker.message}</p>
          </div>
        </div>
      )}

      {/* Dimension breakdown */}
      <div className="space-y-4">
        {result.drivers.map((driver) => (
          <DimensionBar key={driver.dimension} driver={driver} />
        ))}
      </div>

      {/* Excluded dimensions note */}
      {result.excludedDimensions.length > 0 && (
        <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
          <p className="font-medium mb-1">Not included in calculation:</p>
          <p>{result.excludedDimensions.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')}</p>
          <p className="text-xs mt-1">These dimensions lack sufficient evidence</p>
        </div>
      )}

      {/* Confidence indicator */}
      {showConfidence && (
        <div className="flex items-center gap-2 pt-2 border-t">
          <span className="text-sm text-muted-foreground">Confidence:</span>
          <Badge variant="outline" className={getConfidenceColor(result.confidence)}>
            {result.confidence.charAt(0).toUpperCase() + result.confidence.slice(1)}
          </Badge>
          <span className="text-xs text-muted-foreground">{result.confidenceReason}</span>
        </div>
      )}
    </div>
  );
}
