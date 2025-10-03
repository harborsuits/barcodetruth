import { useMemo, useState, useEffect } from "react";
import { User, Sprout, Building2, Users, ExternalLink, CheckCircle2, Info, ChevronDown, ChevronUp, AlertCircle, Clock, Flame, Shield, Newspaper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { lineFromEvent } from "@/lib/events";
import { computeSeverity, type Severity } from "@/lib/severityConfig";
import { getPoliticalContext, getAlignmentBadgeColor, type PoliticalAlignment } from "@/lib/politicsContext";
import { supabase } from "@/integrations/supabase/client";

type CategoryKey = "labor" | "environment" | "politics" | "social" | "cultural-values" | "general";
type EventOrientation = "positive" | "negative" | "mixed";
type Verification = "unverified" | "corroborated" | "official";

interface EventSource {
  name: string;
  url?: string;
  date?: string;
  quote?: string;
  archive_url?: string;
}

export interface BrandEvent {
  event_id?: string;
  brand_id?: string;
  category: CategoryKey;
  title?: string;
  description: string;
  occurred_at?: string;
  date?: string; // alias for occurred_at (backwards compat)
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
  raw_data?: Record<string, any>;
}

const categoryConfig: Record<CategoryKey, { icon: any; label: string; color: string; dotColor: string }> = {
  labor: { icon: User, label: "Labor", color: "text-rose-700", dotColor: "bg-rose-500" },
  environment: { icon: Sprout, label: "Environment", color: "text-emerald-700", dotColor: "bg-emerald-500" },
  politics: { icon: Building2, label: "Politics", color: "text-indigo-700", dotColor: "bg-indigo-500" },
  social: { icon: Users, label: "Social", color: "text-amber-700", dotColor: "bg-amber-500" },
  "cultural-values": { icon: Users, label: "Cultural/Values", color: "text-purple-700", dotColor: "bg-purple-500" },
  general: { icon: Info, label: "General", color: "text-[var(--muted)]", dotColor: "bg-neutral-400" },
};

function scoreTone(n?: number) {
  if (n == null || n === 0) return "text-[var(--muted)]";
  if (n >= 7) return "text-[var(--success)]";
  if (n <= -7) return "text-[var(--danger)]";
  return "text-[var(--warn)]";
}

function relTime(iso?: string): string {
  if (!iso) return "";
  // Guard against future-skewed timestamps (clock drift)
  const ms = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(ms / 60000);
  const h = Math.floor(ms / 36e5);
  const d = Math.floor(h / 24);
  
  if (m < 60) return `${Math.max(1, m)}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 31) return `${d}d ago`;
  const months = Math.floor(d / 30);
  return `${months}mo ago`;
}

function formatDateWithRelative(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  const formatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const relative = relTime(iso);
  return `${formatted} (${relative})`;
}

function isNewEvent(iso?: string): boolean {
  if (!iso) return false;
  const ms = Date.now() - new Date(iso).getTime();
  const days = ms / (1000 * 60 * 60 * 24);
  return days <= 7;
}

function getSeverityUIConfig(severity: Severity, reason: string) {
  if (severity === "severe") {
    return {
      label: "Severe",
      icon: Flame,
      className: "bg-red-600/10 text-red-700 border-red-600/20",
      tooltip: reason || "Major issue requiring attention"
    };
  }
  if (severity === "moderate") {
    return {
      label: "Moderate",
      icon: AlertCircle,
      className: "bg-orange-600/10 text-orange-700 border-orange-600/20",
      tooltip: reason || "Significant concern"
    };
  }
  return {
    label: "Minor",
    icon: Info,
    className: "bg-blue-600/10 text-blue-700 border-blue-600/20",
    tooltip: reason || "Low-level issue"
  };
}

function getSourceLogo(sourceName?: string) {
  if (sourceName === "EPA") return Shield;
  if (sourceName === "OSHA") return Shield;
  if (sourceName === "FEC") return Building2;
  if (sourceName === "The Guardian") return Newspaper;
  if (sourceName === "The New York Times") return Newspaper;
  if (sourceName?.includes("News")) return Newspaper;
  return null;
}

function getVerificationBadge(v?: Verification, verified?: boolean) {
  if (v === "official" || verified) {
    return {
      label: "Official",
      className: "bg-green-600 text-white",
      tooltip: "Official: Sourced from a government or official database (e.g., EPA, OSHA, FDA, FEC)"
    };
  }
  if (v === "corroborated") {
    return {
      label: "Corroborated",
      className: "bg-blue-600/10 text-blue-700 border border-blue-600/20",
      tooltip: "Corroborated: Reported by ≥2 credible, independent sources"
    };
  }
  if (v === "unverified") {
    return {
      label: "Reported",
      className: "bg-neutral-600/10 text-neutral-700 border border-neutral-600/20",
      tooltip: "Reported: Sourced from a reputable news outlet; awaiting agency confirmation or corroboration"
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
  const [politicalAlignment, setPoliticalAlignment] = useState<PoliticalAlignment>(null);
  
  // Single source of truth for timestamp
  const timestamp = event.occurred_at ?? event.date;
  
  useEffect(() => {
    if (typeof window !== 'undefined' && event.event_id) {
      const stored = localStorage.getItem(`source-expanded-${event.event_id}`);
      if (stored === 'true') setShowAllSources(true);
    }
  }, [event.event_id]);

  useEffect(() => {
    // Load user's political alignment preference
    const loadAlignment = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('user_preferences')
          .select('political_alignment')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (data?.political_alignment) {
          setPoliticalAlignment(data.political_alignment as PoliticalAlignment);
        }
      }
    };
    loadAlignment();
  }, []);

  const handleToggleSources = () => {
    const newState = !showAllSources;
    setShowAllSources(newState);
    if (typeof window !== 'undefined' && event.event_id) {
      localStorage.setItem(`source-expanded-${event.event_id}`, String(newState));
    }
  };
  
  const cfg = categoryConfig[event.category] ?? categoryConfig.general;
  const allSources = event.sources ?? (event.source ? [event.source] : []);
  
  // Order sources: official first, then others
  const sortedSources = [...allSources].sort((a, b) => {
    const isOfficialA = ['EPA', 'OSHA', 'FEC', 'FDA'].includes(a.name);
    const isOfficialB = ['EPA', 'OSHA', 'FEC', 'FDA'].includes(b.name);
    if (isOfficialA && !isOfficialB) return -1;
    if (!isOfficialA && isOfficialB) return 1;
    return 0;
  });
  
  const primarySource = sortedSources[0];
  const additionalSources = sortedSources.slice(1);
  
  // Dev logging breadcrumbs (only in dev builds)
  if (process.env.NODE_ENV === 'development' && event.event_id) {
    const sourceCount = allSources.length;
    const hasOfficial = event.verification === 'official' || event.verification === 'corroborated';
    console.debug(`[EventCard] ${event.event_id}: ${sourceCount} sources, verified=${hasOfficial}`);
  }

  const impactChips = useMemo(() => {
    if (!event.impact) return [];
    return Object.entries(event.impact)
      .map(([key, value]) => ({ key, val: Number(value) }))
      .filter(({ val }) => !Number.isNaN(val) && val !== 0)
      .sort((a, b) => Math.abs(b.val) - Math.abs(a.val)); // biggest movement first
  }, [event.impact]);

  const verificationBadge = getVerificationBadge(event.verification, event.verified);
  const attributionLine = lineFromEvent(event);
  const showUnverifiedWarning = event.verification === "unverified" && !showFullDetails;
  
  // Compute severity using centralized config
  const severityResult = useMemo(() => 
    computeSeverity({
      category: event.category as any,
      source: primarySource?.name,
      impact_labor: event.impact?.labor,
      impact_environment: event.impact?.environment,
      impact_politics: event.impact?.politics,
      impact_social: event.impact?.social,
      raw: (event as any).raw_data ?? null,
    }), 
    [event.category, primarySource?.name, event.impact]
  );
  
  const severityConfig = getSeverityUIConfig(severityResult.level, severityResult.reason);
  const isNew = isNewEvent(timestamp);
  const SourceLogo = getSourceLogo(primarySource?.name);
  
  // Political context for FEC events
  const politicalContext = useMemo(() => {
    if (event.category !== 'politics' || !event.raw_data || !politicalAlignment) {
      return null;
    }

    const raw = event.raw_data as any;
    if (raw.dem_percent !== undefined && raw.rep_percent !== undefined) {
      return getPoliticalContext(
        { dem_percent: raw.dem_percent, rep_percent: raw.rep_percent },
        politicalAlignment
      );
    }
    return null;
  }, [event, politicalAlignment]);
  
  // Enhanced tooltip for FEC sources
  const sourceTooltip = useMemo(() => {
    if (primarySource?.name === "FEC") {
      return "Official: Federal Election Commission";
    }
    if (primarySource?.name === "EPA") {
      return "Official: Environmental Protection Agency";
    }
    if (primarySource?.name === "OSHA") {
      return "Official: Occupational Safety and Health Administration";
    }
    return primarySource?.url ?? attributionLine;
  }, [primarySource, attributionLine]);

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
            
            {/* Impact Direction Badge - PROMINENT */}
            {event.severity && (
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md ${
                  event.orientation === 'positive' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-red-600 text-white'
                }`}
                title={event.orientation === 'positive' ? 'Positive for brand score' : 'Negative for brand score'}
              >
                {event.orientation === 'positive' ? '↑ Positive' : '↓ Negative'}
              </span>
            )}
            
            {verificationBadge && (
              <span 
                role="status"
                aria-label={`${verificationBadge.label} – ${verificationBadge.tooltip}`}
                className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md ${verificationBadge.className}`}
                title={verificationBadge.tooltip}
              >
                {SourceLogo && <SourceLogo className="h-3 w-3 opacity-60" />}
                {verificationBadge.label}
              </span>
            )}
            
            <span
              role="status"
              aria-label={`${severityConfig.label} – ${severityConfig.tooltip}`}
              className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md border ${severityConfig.className}`}
              title={severityConfig.tooltip}
            >
              <severityConfig.icon className="h-3 w-3" />
              {severityConfig.label}
            </span>
            
            {isNew && (
              <Badge variant="outline" className="text-xs bg-emerald-600/10 text-emerald-700 border-emerald-600/20">
                <Clock className="h-3 w-3 mr-1" />
                New
              </Badge>
            )}
            
            {event.resolved && (
              <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">
                Resolved
              </Badge>
            )}
            
            {timestamp && (
              <span className="ml-auto text-xs text-[var(--muted)]" title={new Date(timestamp).toLocaleString()}>
                {formatDateWithRelative(timestamp)}
              </span>
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
            <div className="space-y-2">
              <p className="text-sm leading-relaxed text-foreground">
                {event.description}
              </p>
              
              {/* Political Context */}
              {politicalContext && (
                <div className={`p-2 rounded-md border text-xs ${getAlignmentBadgeColor(politicalContext.alignmentMatch)}`}>
                  {politicalContext.message}
                </div>
              )}
            </div>
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
                <div 
                  className="text-xs text-[var(--muted)] italic truncate" 
                  title={sourceTooltip}
                >
                  {attributionLine}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {primarySource.url && (
                    <a
                      href={primarySource.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center gap-1 text-xs text-blue-700 underline underline-offset-2 hover:no-underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                      aria-label={`Open source: ${primarySource.name ?? 'external link'}`}
                      title={`View official source at ${primarySource.name}`}
                    >
                      Source
                      <ExternalLink className="h-3 w-3 opacity-70 group-hover:opacity-100" />
                    </a>
                  )}
                  {primarySource.archive_url && (
                    <>
                      <span className="text-xs text-muted-foreground" aria-hidden="true">·</span>
                      <a
                        href={primarySource.archive_url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 hover:no-underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                        aria-label="View archived version on Wayback Machine"
                        title="Wayback Machine archive - permanent snapshot"
                      >
                        Archive
                        <ExternalLink className="h-3 w-3 opacity-70" />
                      </a>
                    </>
                  )}
                </div>
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
                            <div 
                              className="text-xs text-[var(--muted)] italic truncate"
                              title={source.url ?? source.name}
                            >
                              {source.name}{source.date && `, ${relTime(source.date)}`}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {source.url && (
                                <a
                                  href={source.url}
                                  target="_blank"
                                  rel="noopener noreferrer nofollow"
                                  className="inline-flex items-center gap-1 text-xs text-blue-700 underline underline-offset-2 hover:no-underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                                  aria-label={`Open source: ${source.name ?? 'external link'}`}
                                  title={`View source at ${source.name}`}
                                >
                                  Source
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                              {source.archive_url && (
                                <>
                                  <span className="text-xs text-muted-foreground" aria-hidden="true">·</span>
                                  <a
                                    href={source.archive_url}
                                    target="_blank"
                                    rel="noopener noreferrer nofollow"
                                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 hover:no-underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                                    aria-label="View archived version"
                                    title="Wayback Machine archive"
                                  >
                                    Archive
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </>
                              )}
                            </div>
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
                className="inline-flex items-center gap-1 text-xs text-blue-700 underline underline-offset-2 hover:no-underline"
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
