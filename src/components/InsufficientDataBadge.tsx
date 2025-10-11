import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface InsufficientDataBadgeProps {
  eventCount: number;
  verifiedCount?: number;
  className?: string;
}

export function InsufficientDataBadge({ eventCount, verifiedCount = 0, className = "" }: InsufficientDataBadgeProps) {
  if (eventCount >= 3) return null; // Sufficient data
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`gap-1.5 border-warning text-warning ${className}`}>
            <AlertTriangle className="h-3 w-3" />
            Limited Data
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-1 text-xs">
            <p className="font-semibold">Score based on limited information</p>
            <p>Only {eventCount} {eventCount === 1 ? 'event' : 'events'} found ({verifiedCount} verified).</p>
            <p className="text-muted-foreground mt-2">
              This score uses baseline estimates. Actual performance may differ significantly.
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
