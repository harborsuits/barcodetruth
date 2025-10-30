import { Calendar, TrendingUp } from "lucide-react";

export function DataHealthBadge({
  lastIngestIso,
  eventsCount,
  sourcesCount
}: { 
  lastIngestIso?: string | null; 
  eventsCount?: number; 
  sourcesCount?: number 
}) {
  const days = lastIngestIso 
    ? Math.floor((Date.now() - new Date(lastIngestIso).getTime()) / 86400000) 
    : null;
  
  const freshness =
    days == null ? "unknown" :
    days <= 3 ? "fresh" :
    days <= 14 ? "recent" : "stale";

  const freshnessConfig = {
    fresh: {
      label: "Active",
      className: "bg-success/10 text-success border-success/20"
    },
    recent: {
      label: "Recent",
      className: "bg-warning/10 text-warning border-warning/20"
    },
    stale: {
      label: "Stale",
      className: "bg-muted text-muted-foreground border-border"
    },
    unknown: {
      label: "Pending",
      className: "bg-muted text-muted-foreground border-border"
    }
  };

  const config = freshnessConfig[freshness];

  return (
    <div className="inline-flex items-center gap-3 rounded-lg px-3 py-2 text-xs border bg-card">
      <div className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium ${config.className}`}>
        <TrendingUp className="w-3 h-3" />
        <span>{config.label}</span>
      </div>
      
      <div className="flex items-center gap-1 text-muted-foreground">
        <Calendar className="w-3 h-3" />
        <span>
          {days == null 
            ? "No data yet" 
            : days === 0 
            ? "Updated today"
            : days === 1
            ? "Updated yesterday"
            : `${days}d ago`
          }
        </span>
      </div>
      
      {(eventsCount !== undefined || sourcesCount !== undefined) && (
        <>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-3 text-muted-foreground">
            {eventsCount !== undefined && (
              <span>{eventsCount} event{eventsCount !== 1 ? 's' : ''}</span>
            )}
            {sourcesCount !== undefined && (
              <span>{sourcesCount} source{sourcesCount !== 1 ? 's' : ''}</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
