import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle, Database, TrendingUp } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";

interface DataCollectionBadgeProps {
  eventCount: number;
  categoriesCovered: string[];
  hasSignificantEvents: boolean;
  completeness: number;
  confidenceLevel: 'none' | 'low' | 'medium' | 'high';
  lastIngestAt?: string;
  domains90d?: number;
  ingestStatus?: string;
}

export function DataCollectionBadge({
  eventCount,
  categoriesCovered,
  hasSignificantEvents,
  completeness,
  confidenceLevel,
  lastIngestAt,
  domains90d = 0,
  ingestStatus = 'Active'
}: DataCollectionBadgeProps) {
  const significantCategories = categoriesCovered.filter(cat => 
    ['labor', 'environment', 'political', 'social', 'esg', 'regulatory', 'legal', 'product_safety', 'privacy_ai', 'human_rights_supply', 'antitrust_tax', 'policy'].includes(cat.toLowerCase())
  );
  const getStatusConfig = () => {
    if (confidenceLevel === 'high') {
      return {
        icon: CheckCircle,
        color: "text-green-600 dark:text-green-400",
        bgColor: "bg-green-50 dark:bg-green-950/20",
        borderColor: "border-green-200 dark:border-green-800",
        label: "High Confidence Data",
        description: "Sufficient events collected for reliable scoring"
      };
    }
    if (confidenceLevel === 'medium') {
      return {
        icon: TrendingUp,
        color: "text-blue-600 dark:text-blue-400",
        bgColor: "bg-blue-50 dark:bg-blue-950/20",
        borderColor: "border-blue-200 dark:border-blue-800",
        label: "Building Coverage",
        description: "Collecting more events for comprehensive scoring"
      };
    }
    if (confidenceLevel === 'low') {
      return {
        icon: Database,
        color: "text-yellow-600 dark:text-yellow-400",
        bgColor: "bg-yellow-50 dark:bg-yellow-950/20",
        borderColor: "border-yellow-200 dark:border-yellow-800",
        label: "Early Monitoring",
        description: "Initial data collection in progress"
      };
    }
    return {
      icon: AlertCircle,
      color: "text-gray-600 dark:text-gray-400",
      bgColor: "bg-gray-50 dark:bg-gray-950/20",
      borderColor: "border-gray-200 dark:border-gray-800",
      label: "Monitoring in Progress",
      description: "Actively searching for events"
    };
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <Card className={`p-6 border-2 ${config.borderColor} ${config.bgColor}`}>
      <div className="flex items-start gap-4">
        <div className={`mt-1 ${config.color}`}>
          <Icon className="w-8 h-8" />
        </div>
        
        <div className="flex-1 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-lg">{config.label}</h3>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="outline" className="text-xs">
                      {confidenceLevel.toUpperCase()}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">{config.description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-sm text-muted-foreground">
              {config.description}
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Evidence Coverage</span>
              <span className="font-medium">{completeness}%</span>
            </div>
            <Progress value={completeness} className="h-2" />
            {lastIngestAt && (
              <div className="text-xs text-muted-foreground">
                Last ingest: {formatDistanceToNow(new Date(lastIngestAt), { addSuffix: true })}
              </div>
            )}
            {ingestStatus && ingestStatus !== 'Active' && (
              <div className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                ⚠ {ingestStatus}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div>
              <div className="text-2xl font-bold">{eventCount}</div>
              <div className="text-xs text-muted-foreground">Events (90d)</div>
            </div>
            
            <div>
              <div className="text-2xl font-bold">{domains90d}</div>
              <div className="text-xs text-muted-foreground">Independent Sources</div>
            </div>
            
            <div>
              <div className="text-2xl font-bold">
                {significantCategories.length > 0 ? significantCategories.length : 'None'}
              </div>
              <div className="text-xs text-muted-foreground">
                Signals in E/L/Env
              </div>
            </div>
          </div>

          {significantCategories.length > 0 && (
            <div className="pt-2">
              <div className="text-xs text-muted-foreground mb-2">
                Significant event categories detected:
              </div>
              <div className="flex flex-wrap gap-1">
                {significantCategories.map(cat => (
                  <Badge key={cat} variant="secondary" className="text-xs capitalize">
                    {cat}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {significantCategories.length === 0 && eventCount > 0 && (
            <div className="pt-2 text-xs text-muted-foreground italic">
              All events are general business news or financial market chatter. No ethical/labor/environmental signals yet.
            </div>
          )}

          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground italic">
              {confidenceLevel === 'high' 
                ? "✓ Scores are now visible based on collected data"
                : "Scores will appear when sufficient category-specific events are confirmed (20+ events, 3+ categories, 3+ independent sources)"}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
