import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  CATEGORIES, 
  getCategoryLabel, 
  getCategoryEmoji, 
  type Category,
  type CategoryVector 
} from "@/lib/personalizedScoring";

interface CategoryBreakdownBarsProps {
  newsVector: CategoryVector | null;
  userWeights?: CategoryVector | null;
  isPersonalized?: boolean;
}

function CategoryBar({ 
  category, 
  value, 
  weight 
}: { 
  category: Category; 
  value: number; 
  weight?: number;
}) {
  // Value ranges from about -1 to +1 (capped), we map to visual percentage
  // Center is 50%, negative goes left, positive goes right
  const normalizedValue = Math.max(-1, Math.min(1, value));
  const percentage = 50 + (normalizedValue * 45); // Max 95%, min 5%
  
  const isNegative = value < 0;
  const absValue = Math.abs(value);
  const intensity = absValue > 0.1 ? 'high' : absValue > 0.05 ? 'medium' : 'low';
  
  const barColor = isNegative 
    ? 'bg-danger' 
    : 'bg-success';
  
  const intensityLabel = intensity === 'high' 
    ? 'Significant' 
    : intensity === 'medium' 
      ? 'Moderate' 
      : 'Minor';
  
  const impactLabel = isNegative ? 'negative' : 'positive';
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="space-y-1 cursor-help">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5">
              <span>{getCategoryEmoji(category)}</span>
              <span className="font-medium">{getCategoryLabel(category)}</span>
            </span>
            <span className={`text-xs font-mono ${isNegative ? 'text-danger' : 'text-success'}`}>
              {isNegative ? '−' : '+'}{(absValue * 100).toFixed(1)}
            </span>
          </div>
          
          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
            {/* Center marker */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border z-10" />
            
            {/* Value bar */}
            <div 
              className={`absolute top-0 bottom-0 ${barColor} transition-all duration-500`}
              style={{
                left: isNegative ? `${percentage}%` : '50%',
                right: isNegative ? '50%' : `${100 - percentage}%`,
              }}
            />
          </div>
          
          {weight !== undefined && weight > 0 && (
            <div className="text-xs text-muted-foreground">
              Your weight: {(weight * 100).toFixed(0)}%
            </div>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-xs">
        <p className="font-medium">{getCategoryLabel(category)}</p>
        <p className="text-sm text-muted-foreground">
          {intensityLabel} {impactLabel} impact based on recent news coverage.
        </p>
        {weight !== undefined && weight > 0 && (
          <p className="text-sm text-muted-foreground mt-1">
            This category is weighted at {(weight * 100).toFixed(0)}% in your preferences.
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

export function CategoryBreakdownBars({ 
  newsVector, 
  userWeights,
  isPersonalized 
}: CategoryBreakdownBarsProps) {
  if (!newsVector) {
    return null;
  }
  
  // Check if all values are zero
  const hasActivity = Object.values(newsVector).some(v => v !== 0);
  
  if (!hasActivity) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Category Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No significant category activity detected in recent coverage.
          </p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Category Breakdown</CardTitle>
        <p className="text-sm text-muted-foreground">
          {isPersonalized 
            ? "Impact per category weighted by your preferences"
            : "Recent news impact across each category"
          }
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {CATEGORIES.map(cat => (
          <CategoryBar 
            key={cat}
            category={cat}
            value={newsVector[cat]}
            weight={userWeights?.[cat]}
          />
        ))}
        
        <p className="text-xs text-muted-foreground pt-2 border-t">
          Center = neutral. Left = negative impact. Right = positive impact.
        </p>
      </CardContent>
    </Card>
  );
}
