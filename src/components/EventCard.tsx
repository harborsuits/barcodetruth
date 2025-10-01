import { useMemo, useState, useEffect } from "react";
import { User, Sprout, Building2, Users, ExternalLink, CheckCircle2, Info, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { lineFromEvent } from "@/lib/events";

type CategoryKey = "labor" | "environment" | "politics" | "social" | "cultural-values" | "general";
type EventOrientation = "positive" | "negative" | "mixed";
type Verification = "unverified" | "corroborated" | "official";

interface EventSource {
  name: string;
  url?: string;
  date?: string;
  quote?: string;
}

export interface BrandEvent {
  event_id?: string;
  brand_id?: string;
  category: CategoryKey;
  title?: string;
  description: string;
  date?: string;
  severity?: "minor" | "moderate" | "severe";
  verified?: boolean;
  verification?: Verification;
  orientation?: EventOrientation;
  impact?: Partial<Record<"labor" | "environment" | "politics" | "social", number>>;
  sources?: EventSource[];
  source?: EventSource; // backwards compat
  jurisdiction?: string;
  company_response?: { date?: string; url?: string; summary?: string };
  resolved?: boolean;
}

const categoryConfig: Record<CategoryKey, { icon: any; label: string; color: string }> = {
  labor: { icon: User, label: "Labor", color: "text-labor" },
  environment: { icon: Sprout, label: "Environment", color: "text-environment" },
  politics: { icon: Building2, label: "Politics", color: "text-politics" },
  social: { icon: Users, label: "Social", color: "text-social" },
  "cultural-values": { icon: Users, label: "Cultural/Values", color: "text-[hsl(var(--cultural-values))]" },
  general: { icon: Info, label: "General", color: "text-muted-foreground" },
};

const getSeverityColor = (severity?: string) => {
  if (severity === "severe") return "border-l-danger";
  if (severity === "moderate") return "border-l-warning";
  return "border-l-muted";
};

const formatDate = (dateString?: string): string => {
  if (!dateString) return "Date unknown";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  } catch {
    return dateString;
  }
};

const getVerificationLabel = (verification?: Verification, verified?: boolean): string => {
  if (verification === "official") return "Official";
  if (verification === "corroborated") return "Corroborated";
  if (verified) return "Verified";
  return "Reported";
};

interface EventCardProps {
  event: BrandEvent;
  showFullDetails?: boolean;
  compact?: boolean;
}

export const EventCard = ({ event, showFullDetails = false, compact = false }: EventCardProps) => {
  const [showAllSources, setShowAllSources] = useState(false);
  
  // Persist source expander state per event (optional enhancement)
  useEffect(() => {
    if (event.event_id) {
      const stored = localStorage.getItem(`source-expanded-${event.event_id}`);
      if (stored === 'true') setShowAllSources(true);
    }
  }, [event.event_id]);

  const handleToggleSources = () => {
    const newState = !showAllSources;
    setShowAllSources(newState);
    if (event.event_id) {
      localStorage.setItem(`source-expanded-${event.event_id}`, String(newState));
    }
  };
  
  // Null-safe category config
  const cfg = categoryConfig[(event.category as CategoryKey) ?? "general"];
  const CategoryIcon = cfg?.icon ?? Info;

  // Determine primary source (backwards compat with single source field)
  const allSources = event.sources ?? (event.source ? [event.source] : []);
  const primarySource = allSources[0];
  const additionalSources = allSources.slice(1);
  const hasNoSource = !primarySource;

  // Memoized impact chips
  const impactChips = useMemo(() => {
    if (!event.impact) return [];
    return Object.entries(event.impact)
      .map(([key, value]) => ({ key, val: Number(value) }))
      .filter(({ val }) => !Number.isNaN(val) && val !== 0);
  }, [event.impact]);

  // Determine border color: orientation > severity
  const isPositive = event.orientation === "positive" || impactChips.some(({ val }) => val > 0);
  const borderColor = isPositive ? "border-l-success" : getSeverityColor(event.severity);

  // Get attribution line using utility
  const attributionLine = lineFromEvent(event);
  const showUnverifiedWarning = event.verification === "unverified" && !showFullDetails;

  return (
    <Card className={`border-l-4 ${borderColor} transition-shadow hover:shadow-md`}>
      <CardContent className={compact ? "p-3 space-y-2" : "p-4 space-y-3"}>
        {/* Header: Category Badge + Verification */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={`flex items-center gap-1 ${cfg.color}`}>
            <CategoryIcon className="h-3 w-3" />
            {cfg.label}
          </Badge>
          
          {(event.verified || event.verification) && (
            <Badge 
              variant={event.verification === "official" ? "default" : "secondary"} 
              className="flex items-center gap-1 text-xs"
            >
              <CheckCircle2 className="h-3 w-3" />
              {getVerificationLabel(event.verification, event.verified)}
            </Badge>
          )}
          
          {event.severity && (
            <Badge variant="outline" className="text-xs capitalize">
              {event.severity}
            </Badge>
          )}

          {event.resolved && (
            <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">
              Resolved
            </Badge>
          )}
        </div>

        {/* Title (if present) */}
        {event.title && !compact && (
          <h4 className="font-semibold text-sm">{event.title}</h4>
        )}

        {/* Description */}
        <p className={`leading-relaxed text-foreground ${compact ? "text-xs" : "text-sm"}`}>
          {event.description}
        </p>

        {/* Impact Chips */}
        {impactChips.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-muted-foreground font-medium">Impact:</span>
            {impactChips.map(({ key, val }) => (
              <Badge
                key={key}
                variant="outline"
                className={`text-xs font-medium ${
                  val > 0 
                    ? "bg-success/10 text-success border-success/20" 
                    : "bg-danger/10 text-danger border-danger/20"
                }`}
              >
                {val > 0 ? "+" : ""}{val} {key.charAt(0).toUpperCase() + key.slice(1)}
              </Badge>
            ))}
          </div>
        )}

        {/* Primary Source Citation */}
        {hasNoSource ? (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground/70 italic">
              Source unavailable.
            </p>
          </div>
        ) : (
          <div className="space-y-2 pt-2 border-t">
            {showFullDetails && primarySource?.quote ? (
              <blockquote className="pl-3 border-l-2 border-muted text-xs text-muted-foreground italic leading-relaxed">
                "{primarySource.quote}"
              </blockquote>
            ) : null}
            
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground/70 italic">
                {attributionLine}
              </p>
              {primarySource?.url && (
                <a
                  href={primarySource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`View source from ${primarySource.name}`}
                >
                  Source
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            {/* Unverified Warning */}
            {showUnverifiedWarning && (
              <div className="flex items-start gap-2 p-2 rounded bg-warning/10 border border-warning/20">
                <AlertCircle className="h-3 w-3 text-warning shrink-0 mt-0.5" />
                <p className="text-xs text-warning">
                  This report is not yet corroborated and does not affect the score.
                </p>
              </div>
            )}

            {/* Additional Sources */}
            {additionalSources.length > 0 && (
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 text-xs text-primary hover:no-underline"
                  onClick={handleToggleSources}
                  aria-label={showAllSources ? "Hide additional sources" : "Show additional sources"}
                >
                  {showAllSources ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                  {showAllSources ? "Hide" : "Show"} +{additionalSources.length} more source{additionalSources.length > 1 ? "s" : ""}
                </Button>
                
                {showAllSources && (
                  <div className="space-y-2 pl-3">
                    {additionalSources.map((source, idx) => (
                      <div key={idx} className="space-y-1">
                        {source.quote && (
                          <blockquote className="pl-3 border-l-2 border-muted text-xs text-muted-foreground italic">
                            "{source.quote}"
                          </blockquote>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-muted-foreground/70 italic">
                            {source.name}{source.date && `, ${formatDate(source.date)}`}
                          </p>
                          {source.url && (
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`View source from ${source.name}`}
                            >
                              Source
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Company Response */}
        {event.company_response && (
          <div className="pt-2 border-t space-y-1">
            <p className="text-xs font-medium text-foreground">Company Response:</p>
            <p className="text-xs text-muted-foreground">{event.company_response.summary}</p>
            {event.company_response.url && (
              <a
                href={event.company_response.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
                aria-label="View company response"
              >
                Read full response
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}

        {/* Jurisdiction (if present) */}
        {event.jurisdiction && (
          <p className="text-xs text-muted-foreground">
            Jurisdiction: <span className="font-medium">{event.jurisdiction}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
};
