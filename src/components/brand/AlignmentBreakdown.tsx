import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  AlignmentResult, 
  AlignmentDriver, 
  getAlignmentColor, 
  getConfidenceColor,
  getDimensionEmoji,
  ConfidenceLevel,
  CONFIDENCE_MULTIPLIERS
} from "@/lib/alignmentScore";
import { TrendingUp, TrendingDown, Minus, Info, AlertTriangle, Calculator } from "lucide-react";

interface AlignmentBreakdownProps {
  result: AlignmentResult;
  showConfidence?: boolean;
  showMath?: boolean;       // Show the full calculation table
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

function DimensionBar({ driver, showMath = false }: { driver: AlignmentDriver; showMath?: boolean }) {
  const barColor = driver.impact === 'positive' 
    ? 'bg-green-500' 
    : driver.impact === 'negative' 
      ? 'bg-red-500' 
      : 'bg-muted-foreground';
  
  const confMultiplier = CONFIDENCE_MULTIPLIERS[driver.confidence];
  
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
      
      {/* Math explanation row */}
      {showMath ? (
        <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono bg-muted/30 px-2 py-1 rounded">
          <span>{Math.round(driver.brandScore)}</span>
          <span>×</span>
          <span>{(driver.userWeight * 100).toFixed(0)}%</span>
          <span>×</span>
          <span>{confMultiplier}</span>
          <span>=</span>
          <span className="font-semibold text-foreground">{driver.contribution.toFixed(1)}</span>
        </div>
      ) : (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Weight: {Math.round(driver.userWeight * 100)}%</span>
          <span>Contribution: {driver.contribution > 0 ? '+' : ''}{Math.round(driver.contribution)}</span>
        </div>
      )}
    </div>
  );
}

/** Shows the calculation formula with actual numbers */
function MathBreakdownTable({ result }: { result: AlignmentResult }) {
  const totalContribution = result.drivers.reduce((sum, d) => sum + d.contribution, 0);
  
  return (
    <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Calculator className="h-4 w-4" />
        <span>How your score is calculated</span>
      </div>
      
      {/* Column headers */}
      <div className="grid grid-cols-5 gap-2 text-xs text-muted-foreground font-medium border-b pb-2">
        <div>Dimension</div>
        <div className="text-right">Brand</div>
        <div className="text-right">Weight</div>
        <div className="text-right">Conf.</div>
        <div className="text-right">= Points</div>
      </div>
      
      {/* Rows */}
      {result.drivers.map((driver) => {
        const confMultiplier = CONFIDENCE_MULTIPLIERS[driver.confidence];
        return (
          <div key={driver.dimension} className="grid grid-cols-5 gap-2 text-xs items-center">
            <div className="flex items-center gap-1">
              <span>{getDimensionEmoji(driver.dimension)}</span>
              <span className="truncate">{driver.label}</span>
            </div>
            <div className="text-right font-mono">{Math.round(driver.brandScore)}</div>
            <div className="text-right font-mono">{(driver.userWeight * 100).toFixed(0)}%</div>
            <div className="text-right font-mono text-muted-foreground">×{confMultiplier}</div>
            <div className={`text-right font-mono font-medium ${driver.impact === 'positive' ? 'text-green-600' : driver.impact === 'negative' ? 'text-red-600' : ''}`}>
              {driver.contribution.toFixed(1)}
            </div>
          </div>
        );
      })}
      
      {/* Total row */}
      <div className="grid grid-cols-5 gap-2 text-xs items-center border-t pt-2 font-semibold">
        <div className="col-span-4 text-right">Total Alignment</div>
        <div className="text-right font-mono text-primary">
          {Math.round(totalContribution)}
        </div>
      </div>
      
      {/* Formula explanation */}
      <p className="text-xs text-muted-foreground italic">
        Score = Σ (Brand score × Your weight × Confidence) — normalized to 100
      </p>
    </div>
  );
}

export function AlignmentBreakdown({ result, showConfidence = true, showMath = false, compact = false }: AlignmentBreakdownProps) {
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

      {/* Show calculation table if requested */}
      {showMath && <MathBreakdownTable result={result} />}

      {/* Dimension breakdown (with math rows if showMath is off) */}
      {!showMath && (
        <div className="space-y-4">
          {result.drivers.map((driver) => (
            <DimensionBar key={driver.dimension} driver={driver} showMath={false} />
          ))}
        </div>
      )}

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
