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
  const significantCategories = categoriesCovered.filter(cat => {
    const normalized = cat.toLowerCase();
    return ['labor', 'environment', 'political', 'politics', 'social', 'esg', 'regulatory', 'legal', 'product_safety', 'privacy_ai', 'human_rights_supply', 'antitrust_tax', 'policy'].includes(normalized);
  });
  const getStatusConfig = () => {
    if (confidenceLevel === 'high') {
      return {
        icon: CheckCircle,
        color: "text-primary",
        bgColor: "bg-primary/5",
        borderColor: "border-primary/20",
        label: "High Confidence Data",
        description: "Sufficient events collected for reliable scoring"
      };
    }
    if (confidenceLevel === 'medium') {
      return {
        icon: TrendingUp,
        color: "text-primary",
        bgColor: "bg-primary/5",
        borderColor: "border-primary/20",
        label: "Building Coverage",
        description: "Collecting more events for comprehensive scoring"
      };
    }
    if (confidenceLevel === 'low') {
      return {
        icon: Database,
        color: "text-muted-foreground",
        bgColor: "bg-muted/30",
        borderColor: "border-muted",
        label: "Early Monitoring",
        description: "Initial data collection in progress"
      };
    }
    return {
      icon: AlertCircle,
      color: "text-muted-foreground",
      bgColor: "bg-muted/20",
      borderColor: "border-muted",
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
              <div className="text-xs text-muted-foreground">
                {eventCount === 0 ? 'Events Collected' : 'Evidence Items'}
              </div>
            </div>
            
            <div>
              <div className="text-2xl font-bold">{domains90d}</div>
              <div className="text-xs text-muted-foreground">
                {eventCount === 0 ? 'Monitoring' : 'Independent'} Sources
              </div>
            </div>
            
            <div>
              <div className="text-2xl font-bold">
                {significantCategories.length > 0 ? significantCategories.length : '0'}
              </div>
              <div className="text-xs text-muted-foreground">
                Category {significantCategories.length === 1 ? 'Signal' : 'Signals'}
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
          {eventCount === 0 && domains90d > 0 && (
            <div className="pt-2 px-3 py-2 rounded-lg bg-muted/50 border border-muted">
              <p className="text-sm text-foreground mb-1">
                <span className="font-semibold">What is "evidence"?</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Evidence includes verified news events, regulatory actions, labor incidents, environmental reports, 
                and documented corporate conduct. Currently monitoring {domains90d} sources for relevant events.
              </p>
            </div>
          )}
          {significantCategories.length === 0 && eventCount > 0 && (
            <div className="pt-2 text-xs text-muted-foreground italic">
              Current evidence is general business news. Monitoring for labor, environmental, social, and regulatory signals.
            </div>
          )}

          <div className="pt-2 border-t">
            {completeness >= 90 && confidenceLevel !== 'high' && (
              <div className="mb-3 text-xs px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-foreground">
                <span className="font-semibold">🎯 Scores unlocking soon</span> — evidence coverage at {completeness}%
              </div>
            )}
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
