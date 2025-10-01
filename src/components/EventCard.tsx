import { useMemo, useState, useEffect } from "react";
import { User, Sprout, Building2, Users, ExternalLink, CheckCircle2, Info, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
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
  source?: EventSource;
  jurisdiction?: string;
  company_response?: { date?: string; url?: string; summary?: string };
  resolved?: boolean;
}

const categoryConfig: Record<CategoryKey, { icon: any; label: string; color: string; dotColor: string }> = {
  labor: { icon: User, label: "Labor", color: "text-rose-700", dotColor: "bg-rose-500" },
  environment: { icon: Sprout, label: "Environment", color: "text-emerald-700", dotColor: "bg-emerald-500" },
  politics: { icon: Building2, label: "Politics", color: "text-indigo-700", dotColor: "bg-indigo-500" },
  social: { icon: Users, label: "Social", color: "text-amber-700", dotColor: "bg-amber-500" },
  "cultural-values": { icon: Users, label: "Cultural/Values", color: "text-purple-700", dotColor: "bg-purple-500" },
  general: { icon: Info, label: "General", color: "text-muted-foreground", dotColor: "bg-muted" },
};

function scoreTone(n?: number) {
  if (n == null || n === 0) return "text-[var(--muted)]";
  if (n >= 7) return "text-[var(--success)]";
  if (n <= -7) return "text-[var(--danger)]";
  return "text-[var(--warn)]";
}

function relTime(iso?: string): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  const h = Math.floor(ms / 36e5);
  
  if (m < 60) return `${Math.max(1, m)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}

function getVerificationBadge(v?: Verification, verified?: boolean) {
  if (v === "official" || verified) {
    return {
      label: "Official",
      className: "bg-green-600 text-white",
      tooltip: "Government or regulatory source"
    };
  }
  if (v === "corroborated") {
    return {
      label: "Corroborated",
      className: "bg-blue-600/10 text-blue-700 border border-blue-600/20",
      tooltip: "≥2 credible sources"
    };
  }
  if (v === "unverified") {
    return {
      label: "Unverified",
      className: "bg-neutral-600/10 text-neutral-700 border border-neutral-600/20",
      tooltip: "Single source"
    };
  }
  return null;
}

interface EventCardProps {
  event: BrandEvent;
  showFullDetails?: boolean;
  compact?: boolean;
}

export const EventCard = ({ event, showFullDetails = false, compact = false }: EventCardProps) => {
  const [showAllSources, setShowAllSources] = useState(false);
  
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
  
  const cfg = categoryConfig[event.category] ?? categoryConfig.general;
  const allSources = event.sources ?? (event.source ? [event.source] : []);
  const primarySource = allSources[0];
  const additionalSources = allSources.slice(1);

  const impactChips = useMemo(() => {
    if (!event.impact) return [];
    return Object.entries(event.impact)
      .map(([key, value]) => ({ key, val: Number(value) }))
      .filter(({ val }) => !Number.isNaN(val) && val !== 0);
  }, [event.impact]);

  const verificationBadge = getVerificationBadge(event.verification, event.verified);
  const attributionLine = lineFromEvent(event);
  const showUnverifiedWarning = event.verification === "unverified" && !showFullDetails;

  return (
    <article 
      className="group rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 transition-all duration-150 ease-[var(--ease)] hover:shadow-[var(--shadow-md)]"
      aria-labelledby={event.event_id ? `event-${event.event_id}` : undefined}
    >
      <div className="flex items-start gap-3">
        {/* Category dot */}
        <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${cfg.dotColor}`} />
        
        <div className="min-w-0 flex-1 space-y-3">
          {/* Header row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-medium ${cfg.color}`}>
              {cfg.label}
            </span>
            
            {verificationBadge && (
              <span 
                className={`text-[11px] px-1.5 py-0.5 rounded-md ${verificationBadge.className}`}
                title={verificationBadge.tooltip}
              >
                {verificationBadge.label}
              </span>
            )}
            
            {event.resolved && (
              <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">
                Resolved
              </Badge>
            )}
            
            {event.date && (
              <span className="ml-auto text-xs text-[var(--muted)]">{relTime(event.date)}</span>
            )}
          </div>

          {/* Title */}
          {event.title && (
            <h4 
              id={event.event_id ? `event-${event.event_id}` : undefined}
              className={`font-semibold leading-snug ${compact ? "text-sm" : "text-base"}`}
            >
              {event.title}
            </h4>
          )}

          {/* Description */}
          {!compact && (
            <p className="text-sm leading-relaxed text-foreground">
              {event.description}
            </p>
          )}

          {/* Impact chips */}
          {impactChips.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-[var(--muted)] font-medium">Impact:</span>
              {impactChips.map(({ key, val }) => (
                <Badge
                  key={key}
                  variant="outline"
                  className={`text-xs font-medium ${scoreTone(val)}`}
                >
                  {val > 0 ? "+" : ""}{val} {key.charAt(0).toUpperCase() + key.slice(1)}
                </Badge>
              ))}
            </div>
          )}

          {/* Primary source */}
          {primarySource && (
            <div className="space-y-2 pt-2 border-t">
              {showFullDetails && primarySource.quote && (
                <blockquote className="pl-3 border-l-2 border-muted text-xs text-muted-foreground italic leading-relaxed">
                  "{primarySource.quote}"
                </blockquote>
              )}
              
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-[var(--muted)] italic">
                  {attributionLine}
                </p>
                {primarySource.url && (
                  <a
                    href={primarySource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline shrink-0"
                    aria-label={`Open source: ${primarySource.name}`}
                  >
                    Source
                    <ExternalLink className="h-3 w-3 opacity-70 group-hover:opacity-100" />
                  </a>
                )}
              </div>

              {/* Unverified warning */}
              {showUnverifiedWarning && (
                <div className="flex items-start gap-2 p-2 rounded bg-warning/10 border border-warning/20">
                  <AlertCircle className="h-3 w-3 text-warning shrink-0 mt-0.5" />
                  <p className="text-xs text-warning">
                    This report is not yet corroborated and does not affect the score.
                  </p>
                </div>
              )}

              {/* Additional sources */}
              {additionalSources.length > 0 && (
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 text-xs text-primary hover:no-underline"
                    onClick={handleToggleSources}
                    aria-expanded={showAllSources}
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
                            <p className="text-xs text-[var(--muted)] italic">
                              {source.name}{source.date && `, ${relTime(source.date)}`}
                            </p>
                            {source.url && (
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
                                aria-label={`Open source: ${source.name}`}
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

          {/* Company response */}
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
                  aria-label="View company response"
                >
                  Read full response
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}

          {/* Jurisdiction */}
          {event.jurisdiction && (
            <p className="text-xs text-[var(--muted)]">
              Jurisdiction: <span className="font-medium">{event.jurisdiction}</span>
            </p>
          )}
        </div>
      </div>
    </article>
  );
};
