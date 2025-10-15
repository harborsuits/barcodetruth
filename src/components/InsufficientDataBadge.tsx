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
            <p className="font-semibold">{meta.level === 'none' ? 'No verified events' : 'Limited data'}</p>
            {eventCount === 0 ? (
              <p>No verified events found yet. Score will appear once we have cited sources.</p>
            ) : (
              <p>Only {eventCount} {eventCount === 1 ? 'event' : 'events'} found, {Math.round(verifiedRate * 100)}% verified from {independentSources} source{independentSources !== 1 ? 's' : ''}.</p>
            )}
            <p className="text-muted-foreground mt-2">
              We only show scores backed by real evidence from independent sources.
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
