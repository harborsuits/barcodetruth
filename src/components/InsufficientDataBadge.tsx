import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { confidenceMeta } from "@/lib/confidence";

interface InsufficientDataBadgeProps {
  eventCount: number;
  verifiedRate: number;
  independentSources: number;
  className?: string;
}

export function InsufficientDataBadge({ 
  eventCount, 
  verifiedRate, 
  independentSources, 
  className = "" 
}: InsufficientDataBadgeProps) {
  const meta = confidenceMeta(eventCount, verifiedRate, independentSources);
  
  // Only show badge for low confidence
  if (meta.level !== 'low' && meta.level !== 'none') return null;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`gap-1.5 border-warning text-warning ${className}`}>
            <AlertTriangle className="h-3 w-3" />
            {meta.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-1 text-xs">
            <p className="font-semibold">Score based on {meta.level === 'none' ? 'no data' : 'limited information'}</p>
            {eventCount === 0 ? (
              <p>No events found. This score uses baseline estimates only.</p>
            ) : (
              <p>Only {eventCount} {eventCount === 1 ? 'event' : 'events'} found, {Math.round(verifiedRate * 100)}% verified from {independentSources} source{independentSources !== 1 ? 's' : ''}.</p>
            )}
            <p className="text-muted-foreground mt-2">
              Actual performance may differ significantly. We'll update once more independent, verified sources report on this brand.
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
