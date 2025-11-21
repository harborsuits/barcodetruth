import { useMemo, useState, useEffect } from "react";
import { User, Sprout, Building2, Users, ExternalLink, CheckCircle2, Info, ChevronDown, ChevronUp, AlertCircle, Clock, Flame, Shield, Newspaper, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { lineFromEvent } from "@/lib/events";
import { computeSeverity, type Severity } from "@/lib/severityConfig";
import { getPoliticalContext, getAlignmentBadgeColor, type PoliticalAlignment } from "@/lib/politicsContext";
import { summarizeEvent } from "@/lib/eventSummary";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { isGeneric as checkIfGeneric } from "@/lib/links";

type CategoryKey = "labor" | "environment" | "politics" | "social" | "cultural-values" | "general";
type EventOrientation = "positive" | "negative" | "mixed";
type Verification = "unverified" | "corroborated" | "official";

interface EventSource {
  name: string;
  url?: string;
  date?: string;
  quote?: string;
  archive_url?: string;
  canonical_url?: string;
  is_generic?: boolean;
  link_kind?: 'article' | 'database' | 'homepage';
  credibility_tier?: 'official' | 'reputable' | 'local' | 'unknown';
  ai_summary?: string;
  article_title?: string;
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
  
  const date = new Date(iso);
  // Validate date
  if (isNaN(date.getTime())) return "";
  
  // Guard against future-skewed timestamps (clock drift)
  const ms = Math.max(0, Date.now() - date.getTime());
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
  // Validate date before formatting
  if (isNaN(date.getTime())) {
    console.warn('[EventCard] Invalid date:', iso);
    return "Date unknown";
  }
  
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
  if (sourceName === "SEC EDGAR" || sourceName === "SEC") return FileText;
  if (sourceName === "Reddit") return Users;
  if (sourceName === "Google News") return Newspaper;
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
      className: "bg-blue-600 text-white",
      tooltip: "Corroborated: Reported by 2+ independent sources"
    };
  }
  return {
    label: "Unverified",
    className: "bg-gray-500 text-white",
    tooltip: "Unverified: From a single source, not yet corroborated"
  };
}

interface EventCardProps {
  event: BrandEvent;
  showFullDetails?: boolean;
  compact?: boolean;
}

export const EventCard = ({ event, showFullDetails = false, compact = false }: EventCardProps) => {
  const [showAllSources, setShowAllSources] = useState(false);
  const [politicalAlignment, setPoliticalAlignment] = useState<PoliticalAlignment>(null);
  const [showSimplified, setShowSimplified] = useState(false);
  const [simplified, setSimplified] = useState<{
    tldr: string;
    whatHappened: string[];
    whyItMatters: string[];
    keyFacts: string[];
    quote: string;
  } | null>(null);
  const [isSimplifying, setIsSimplifying] = useState(false);
  const { toast } = useToast();

  const limitedDetails = useMemo(() => {
    if (!simplified) return false;
    const blob = [simplified.tldr, ...(simplified.whatHappened || []), ...(simplified.keyFacts || [])].join(' ');
    const hasSpecifics = /\$\d|\d+\s?(percent|%|ppm|tons?|mg|kg)|\b(19|20)\d{2}\b|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(blob);
    const mentionsLimited = /limited details/i.test(blob);
    return mentionsLimited || !hasSpecifics;
  }, [simplified]);
  
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
  
  // Determine link action based on link_kind
  const linkKind = primarySource?.link_kind;
  const articleUrl = primarySource?.archive_url || primarySource?.canonical_url || null;
  const dbUrl = primarySource?.url || primarySource?.archive_url || null;
  
  const action = linkKind === 'article'
    ? { label: 'View Article', href: articleUrl }
    : linkKind === 'database'
      ? { label: 'View Database', href: dbUrl }
      : null;
  
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
  
  // Enhanced tooltip for sources
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
    if (primarySource?.name === "SEC EDGAR" || primarySource?.name === "SEC") {
      return "Official: Securities and Exchange Commission";
    }
    if (primarySource?.name === "Reddit") {
      return "Social Media: Reddit community discussions";
    }
    if (primarySource?.name === "Google News") {
      return "News Aggregator: Google News";
    }
    return primarySource?.url ?? attributionLine;
  }, [primarySource, attributionLine]);

  const handleSimplify = async () => {
    if (simplified) {
      setShowSimplified(!showSimplified);
      return;
    }

    setIsSimplifying(true);
    try {
      const sourceUrl = primarySource?.url || event.raw_data?.source_url || '';
      const sourceDomain = sourceUrl ? new URL(sourceUrl).hostname : 'unknown';
      
      const { data, error } = await supabase.functions.invoke('simplify-description', {
        body: {
          eventId: event.event_id,
          description: event.description,
          category: event.category,
          title: event.title,
          severity: event.severity,
          occurredAt: timestamp,
          verification: event.verification,
          sourceName: primarySource?.name || 'Unknown',
          sourceDomain,
          refresh: true
        }
      });

      if (error) {
        if (error.message?.includes('Rate limit')) {
          toast({
            title: 'Rate limit exceeded',
            description: 'Please wait a moment before trying again',
            variant: 'destructive'
          });
        } else {
          throw error;
        }
        return;
      }

      if (data) {
        setSimplified(data);
        setShowSimplified(true);
      }
    } catch (error: any) {
      console.error('Error simplifying:', error);
      toast({
        title: 'Unable to simplify',
        description: error.message || 'Please try again later',
        variant: 'destructive'
      });
    } finally {
      setIsSimplifying(false);
    }
  };

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
            {/* Only show category in full mode */}
            {!compact && (
              <span className={`text-xs font-medium ${cfg.color}`}>
                {cfg.label}
              </span>
            )}
            
            {/* Impact Direction Badge - PROMINENT */}
            {!compact && event.severity && event.orientation && (
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md ${
                  event.orientation === 'positive' 
                    ? 'bg-green-600 text-white' 
                    : event.orientation === 'negative'
                    ? 'bg-red-600 text-white'
                    : 'bg-muted/80 text-foreground border border-border'
                }`}
                title={
                  event.orientation === 'positive' 
                    ? 'Positive impact on brand score' 
                    : event.orientation === 'negative'
                    ? 'Negative impact on brand score'
                    : 'Mixed or contextual impact'
                }
              >
                {event.orientation === 'positive' ? '↑ Positive' : event.orientation === 'negative' ? '↓ Negative' : '↔︎ Mixed'}
              </span>
            )}
            
            {!compact && verificationBadge && (
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
            
            {!compact && (
              <span
                role="status"
                aria-label={`${severityConfig.label} – ${severityConfig.tooltip}`}
                className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md border ${severityConfig.className}`}
                title={severityConfig.tooltip}
              >
                <severityConfig.icon className="h-3 w-3" />
                {severityConfig.label}
              </span>
            )}
            
            {!compact && isNew && (
              <Badge variant="outline" className="text-xs bg-emerald-600/10 text-emerald-700 border-emerald-600/20">
                <Clock className="h-3 w-3 mr-1" />
                New
              </Badge>
            )}
            
            {!compact && event.resolved && (
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
            <>
              {/* Summary line (category-prefixed, skimmable) */}
              <p className="text-xs text-muted-foreground mb-1" title={summarizeEvent(event)}>
                {summarizeEvent(event)}
              </p>
              <h4 
                id={event.event_id ? `event-${event.event_id}` : undefined}
                className={`font-semibold leading-snug ${compact ? "text-sm" : "text-base"}`}
              >
                {event.title}
              </h4>
            </>
          )}

          {/* Description - show brief version in compact mode */}
          {compact ? (
            <p className="text-sm leading-relaxed text-foreground line-clamp-2">
              {event.description}
            </p>
          ) : (
            <div className="space-y-2">
              <div className="space-y-2">
                <p className="text-sm leading-relaxed text-foreground">
                  {event.description}
                </p>
                
              {/* SOURCE ATTRIBUTION - PROMINENT */}
              {primarySource && (
                <div className="flex items-center gap-2 pt-2 pb-1 text-sm border-t mt-3">
                  <span className="text-muted-foreground font-medium">Source:</span>
                  {(primarySource.canonical_url || primarySource.archive_url || primarySource.url) ? (
                    <a
                      href={primarySource.canonical_url || primarySource.archive_url || primarySource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {primarySource.name}
                      {primarySource.date && (
                        <span className="text-muted-foreground font-normal">
                          · {new Date(primarySource.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </a>
                  ) : (
                    <span className="font-medium">{primarySource.name}</span>
                  )}
                  {verificationBadge && (
                    <span 
                      className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md ${verificationBadge.className}`}
                      title={verificationBadge.tooltip}
                    >
                      {verificationBadge.label}
                    </span>
                  )}
                </div>
              )}

              {/* Simplified explanation */}
              {showSimplified && simplified && (
                <div className="mt-4 p-4 bg-muted/50 rounded-lg border space-y-3">
                  <div className="flex items-start justify-between gap-2 text-xs pb-2 border-b">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Info className="h-3.5 w-3.5" />
                      <span>AI summary from cited source</span>
                      {limitedDetails && (
                        <span className="px-1.5 py-0.5 bg-amber-600/10 text-amber-700 text-[10px] rounded-md border border-amber-600/20">
                          Limited details
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSimplify}
                      className="h-6 px-2 text-xs -mt-1"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  {simplified.tldr && (
                    <div>
                      <p className="text-xs font-semibold mb-1 uppercase tracking-wide text-muted-foreground">TL;DR</p>
                      <p className="text-sm leading-relaxed">{simplified.tldr}</p>
                    </div>
                  )}

                  {simplified.whatHappened && simplified.whatHappened.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold mb-1.5 uppercase tracking-wide text-muted-foreground">What Happened</p>
                      <ul className="space-y-1 text-sm leading-relaxed">
                        {simplified.whatHappened.map((item, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-muted-foreground mt-0.5">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {simplified.whyItMatters && simplified.whyItMatters.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold mb-1.5 uppercase tracking-wide text-muted-foreground">Why It Matters</p>
                      <ul className="space-y-1 text-sm leading-relaxed">
                        {simplified.whyItMatters.map((item, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-muted-foreground mt-0.5">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {simplified.keyFacts && simplified.keyFacts.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold mb-1.5 uppercase tracking-wide text-muted-foreground">Key Facts</p>
                      <ul className="space-y-1 text-sm leading-relaxed">
                        {simplified.keyFacts.map((item, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-muted-foreground mt-0.5">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {simplified.quote && (
                    <blockquote className="pl-3 border-l-2 border-muted text-sm italic text-muted-foreground">
                      "{simplified.quote}"
                    </blockquote>
                  )}
                </div>
              )}

              {/* Unverified warning */}
              {showUnverifiedWarning && (
                <div className="flex items-start gap-2 p-2 rounded bg-warning/10 border border-warning/20 mt-3">
                  <AlertCircle className="h-3 w-3 text-warning shrink-0 mt-0.5" />
                  <p className="text-xs text-warning">
                    This report is not yet corroborated and does not affect the score.
                  </p>
                </div>
              )}

              {/* Additional sources */}
              {additionalSources.length > 0 && (
                <div className="space-y-2 pt-2 border-t mt-3">
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
                              {(source.url || source.archive_url || source.canonical_url) && (
                                <a
                                  href={source.canonical_url || source.archive_url || source.url || '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                  aria-label={`Open source: ${source.name ?? 'external link'}`}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  View
                                </a>
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
