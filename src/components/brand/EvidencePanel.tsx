import { useMemo, useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertCircle, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getCategoryDisplay } from '@/lib/categoryConfig';
import { deduplicateEvents } from '@/lib/deduplicateEvents';

type EvidenceItem = {
  event_id?: string;
  event_date: string;
  title: string | null;
  verification?: "official" | "corroborated" | "unverified" | string | null;
  source_name?: string | null;
  canonical_url?: string | null;
  category?: "labor" | "environment" | "politics" | "social" | string | null;
  category_code?: string | null;
  ai_summary?: string | null;
  secondary_categories?: string[] | null;
  noise_reason?: string | null;
};

type Props = {
  evidence: EvidenceItem[];
  onReport: (eventId?: string) => void;
  onSuggest: () => void;
  brandName?: string;
};

const CATEGORY_GROUPS: Record<string, number> = {
    'Product Safety': 10,
    'Regulatory': 20,
    'Legal': 30,
    'Labor': 40,
    'Financial': 50,
    'Policy': 60,
    'ESG (Environment)': 70,
    'Social & Cultural': 80,
    'Noise': 90
  };

const CODE_TO_GROUP: Record<string, string> = {
    'FIN.EARNINGS': 'Financial',
    'FIN.MARKETS': 'Financial',
    'FIN.MNA': 'Financial',
    'FIN.INSTITUTIONAL': 'Financial',
    'FIN.GENERAL': 'Financial',
    'PRODUCT.SAFETY': 'Product Safety',
    'PRODUCT.RECALL': 'Product Safety',
    'LEGAL.LITIGATION': 'Legal',
    'LEGAL.SETTLEMENT': 'Legal',
    'LEGAL.LAWSUIT': 'Legal',
    'REGULATORY.ENFORCEMENT': 'Regulatory',
    'REGULATORY.FILING': 'Regulatory',
    'REGULATORY.EPA': 'Regulatory',
    'REGULATORY.OSHA': 'Regulatory',
    'LABOR.PRACTICES': 'Labor',
    'LABOR.UNION': 'Labor',
    'LABOR.SAFETY': 'Labor',
    'ESG.ENVIRONMENT': 'ESG (Environment)',
    'ESG.SOCIAL': 'Social & Cultural',
    'ENV.POLLUTION': 'ESG (Environment)',
    'ENV.EMISSIONS': 'ESG (Environment)',
    'SOC.CULTURE': 'Social & Cultural',
    'POLICY.PUBLIC': 'Policy',
    'POLICY.POLITICAL': 'Policy',
    'NOISE.GENERAL': 'Noise',
    'NOISE.FINANCIAL': 'Noise'
  };

export function EvidencePanel({ evidence, onReport, onSuggest, brandName = "this brand" }: Props) {
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showAll, setShowAll] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);

  // Analytics: track filter changes
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).rudderstack?.track) {
      (window as any).rudderstack.track('EvidenceCategoryFilter', { category: categoryFilter });
    }
  }, [categoryFilter]);

  // First deduplicate using string similarity
  const deduplicatedEvidence = useMemo(() => {
    return deduplicateEvents(evidence);
  }, [evidence]);

  // Memoize heavy transforms for performance
  const evidenceWithGroups = useMemo(() => {
    const getGroupName = (code?: string | null, legacyCategory?: string | null): string => {
      if (code && CODE_TO_GROUP[code]) {
        return CODE_TO_GROUP[code];
      }
      if (code) {
        const prefix = code.split('.')[0];
        if (prefix === 'FIN') return 'Financial';
        if (prefix === 'PRODUCT') return 'Product Safety';
        if (prefix === 'LEGAL') return 'Legal';
        if (prefix === 'REGULATORY') return 'Regulatory';
        if (prefix === 'LABOR') return 'Labor';
        if (prefix === 'ESG' || prefix === 'ENV') return 'ESG (Environment)';
        if (prefix === 'SOC') return 'Social & Cultural';
        if (prefix === 'POLICY') return 'Policy';
        if (prefix === 'NOISE') return 'Noise';
      }
      if (legacyCategory === 'labor') return 'Labor';
      if (legacyCategory === 'environment') return 'ESG (Environment)';
      if (legacyCategory === 'politics') return 'Policy';
      if (legacyCategory === 'social') return 'Social & Cultural';
      return 'Noise';
    };

    const getVerificationRank = (v?: string | null) =>
      v === 'official' ? 1 : v === 'corroborated' ? 2 : 3;

    return deduplicatedEvidence.map(ev => ({
      ...ev,
      group_name: getGroupName(ev.category_code, ev.category),
      group_order: CATEGORY_GROUPS[getGroupName(ev.category_code, ev.category)] ?? 90,
      verification_rank: getVerificationRank(ev.verification ?? null),
    }));
  }, [deduplicatedEvidence]);

  const clusteredEvidence = useMemo(() => {
    return evidenceWithGroups;
  }, [evidenceWithGroups]);

  const filteredEvidence = useMemo(() => {
    return categoryFilter === 'all'
      ? clusteredEvidence
      : clusteredEvidence.filter((e: any) => e.group_name === categoryFilter);
  }, [clusteredEvidence, categoryFilter]);

  const sortedEvidence = useMemo(() => {
    return [...filteredEvidence].sort((a: any, b: any) => {
      if (a.group_order !== b.group_order) return a.group_order - b.group_order;
      if (a.verification_rank !== b.verification_rank) return a.verification_rank - b.verification_rank;
      return new Date(b.event_date).getTime() - new Date(a.event_date).getTime();
    });
  }, [filteredEvidence]);

  const grouped = useMemo(() => {
    const acc: Record<string, any[]> = {};
    for (const ev of sortedEvidence) {
      (acc[ev.group_name] ??= []).push(ev);
    }
    return acc;
  }, [sortedEvidence]);

  const groupOrder = useMemo(() => {
    return Object.keys(grouped).sort((a, b) => (CATEGORY_GROUPS[a] ?? 90) - (CATEGORY_GROUPS[b] ?? 90));
  }, [grouped]);

  // Limit to 5 articles initially
  const displayedEvidence = useMemo(() => {
    if (showAll || sortedEvidence.length <= 5) return sortedEvidence;
    return sortedEvidence.slice(0, 5);
  }, [sortedEvidence, showAll]);

  const displayedGrouped = useMemo(() => {
    const acc: Record<string, any[]> = {};
    for (const ev of displayedEvidence) {
      (acc[ev.group_name] ??= []).push(ev);
    }
    return acc;
  }, [displayedEvidence]);

  const displayedGroupOrder = useMemo(() => {
    return Object.keys(displayedGrouped).sort((a, b) => (CATEGORY_GROUPS[a] ?? 90) - (CATEGORY_GROUPS[b] ?? 90));
  }, [displayedGrouped]);

  const hasMore = sortedEvidence.length > 5;

  const uniqueCount = deduplicatedEvidence.length;
  const totalCount = evidence.length;

  return (
    <div className="space-y-4">
      {/* Context Header - Explain what they're looking at */}
      <div className="p-4 rounded-lg bg-muted/30 border border-border">
        <p className="font-medium text-sm mb-1">Recent Signals</p>
        <p className="text-xs text-muted-foreground">
          These are third-party reports connected to {brandName}. We categorize by type but don't rank or editorialize them.
        </p>
        <div className="flex flex-wrap gap-2 mt-3 text-xs">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Labor — worker rights, safety</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Environment — climate, pollution</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500" /> Politics — lobbying, donations</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> Social — conduct, discrimination</span>
        </div>
      </div>

      {/* Header with stats and toggle */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {uniqueCount} unique {uniqueCount === 1 ? 'story' : 'stories'}
          {totalCount > uniqueCount && (
            <span> from {totalCount} {totalCount === 1 ? 'source' : 'sources'}</span>
          )}
        </div>
        {totalCount > uniqueCount && (
          <button
            onClick={() => setShowDuplicates(!showDuplicates)}
            className="text-xs text-primary hover:underline"
          >
            {showDuplicates ? 'Hide' : 'Show'} duplicate sources
          </button>
        )}
      </div>

      {/* Category Filter with semantic roles */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Evidence categories">
        {[
          { label: 'All', value: 'all' },
          { label: 'Product Safety', value: 'Product Safety' },
          { label: 'Regulatory', value: 'Regulatory' },
          { label: 'Legal', value: 'Legal' },
          { label: 'Labor', value: 'Labor' },
          { label: 'Financial', value: 'Financial' },
          { label: 'Policy', value: 'Policy' },
          { label: 'ESG (Environment)', value: 'ESG (Environment)' },
          { label: 'Social & Cultural', value: 'Social & Cultural' },
          { label: 'Noise', value: 'Noise' },
        ].map((filter) => (
          <button
            key={filter.value}
            role="tab"
            aria-selected={categoryFilter === filter.value}
            onClick={() => setCategoryFilter(filter.value)}
            className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
              categoryFilter === filter.value
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-background hover:bg-muted border-border'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Noise explainer */}
      {categoryFilter === 'Noise' && (
        <div className="text-xs text-muted-foreground italic p-3 bg-muted/50 rounded-lg border">
          <span className="font-medium">ℹ️ Market commentary:</span> These events are financial analysis, stock tips, or general business news. They're excluded from ethics scoring to focus on labor, environmental, and social impact.
        </div>
      )}

      {/* Two-lane summary when showing all */}
      {categoryFilter === 'all' && evidence.length > 0 && (
        <div className="flex gap-4 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 rounded-full">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-primary font-medium">
              {evidence.filter(e => !e.category_code?.startsWith('NOISE')).length} verified mentions
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full">
            <span className="w-2 h-2 rounded-full bg-muted-foreground/50" />
            <span className="text-muted-foreground">
              {evidence.filter(e => e.category_code?.startsWith('NOISE')).length} other coverage
            </span>
          </div>
        </div>
      )}

      {/* Evidence list with semantic structure */}
      {!displayedEvidence.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
          {evidence.length === 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">No verified coverage yet</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                We haven't tracked verified third-party coverage for {brandName} yet. 
                This section updates automatically as we find credible sources.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                No {categoryFilter} events found
              </p>
              <p className="text-xs">
                {evidence.length} event{evidence.length !== 1 ? 's' : ''} available in other categories.
                <button
                  onClick={() => setCategoryFilter('all')}
                  className="ml-2 text-primary hover:underline"
                >
                  Show all
                </button>
              </p>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-6" role="list" aria-label="Evidence timeline">
            {displayedGroupOrder.map(groupName => (
              <section key={groupName} className="space-y-3" aria-labelledby={`group-${groupName}`}>
                {/* Group Header */}
                <div className="flex items-center gap-2 pb-2 border-b">
                  <h4 id={`group-${groupName}`} className="font-semibold text-sm">{groupName}</h4>
                  <Badge variant="secondary" className="text-xs">
                    {displayedGrouped[groupName].length}
                  </Badge>
                </div>

                {/* Events - use stable keys */}
                {displayedGrouped[groupName].map((ev, idx) => {
                const isOfficial = ev.verification === 'official';
                const isCorroborated = ev.verification === 'corroborated';
                const isNoise = ev.category_code?.startsWith('NOISE');

                return (
                  <article
                    key={ev.event_id ?? `ev-${idx}`}
                    className={`p-4 rounded-lg border transition-colors ${
                      isOfficial ? 'border-destructive/50 bg-destructive/5' :
                      isCorroborated ? 'border-primary/50 bg-primary/5' :
                      'border-border bg-card'
                    } ${isNoise ? 'opacity-70' : ''}`}
                    role="listitem"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex-shrink-0 ${
                        isOfficial ? 'text-destructive' :
                        isCorroborated ? 'text-primary' :
                        'text-muted-foreground'
                      }`}>
                        {isOfficial ? '⚠️' : isCorroborated ? '⚖️' : '📰'}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Badges */}
                        <div className="flex flex-wrap gap-2 mb-2">
                          <Badge
                            variant={
                              isOfficial ? 'destructive' :
                              isCorroborated ? 'default' :
                              'outline'
                            }
                            className="text-xs"
                          >
                            {ev.verification === 'official' ? 'Official' :
                             ev.verification === 'corroborated' ? 'Multiple Sources' :
                             'Unverified'}
                          </Badge>

                          {(() => {
                            const categoryDisplay = getCategoryDisplay(ev.category_code);
                            return (
                              <Badge
                                variant="outline"
                                className={`text-xs ${categoryDisplay.color}`}
                              >
                                {categoryDisplay.group}: {categoryDisplay.label}
                              </Badge>
                            );
                          })()}

                          {ev.secondary_categories?.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {ev.secondary_categories.map((secCat: string, idx: number) => (
                                <Badge
                                  key={idx}
                                  variant="secondary"
                                  className="text-xs opacity-70"
                                >
                                  +{secCat}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {ev.noise_reason && ev.category_code?.startsWith('NOISE') && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="text-xs cursor-help">
                                  ℹ️ Not scored
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">{ev.noise_reason}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}

                          <span className="text-xs text-muted-foreground">
                            {ev.event_date && !isNaN(new Date(ev.event_date).getTime())
                              ? formatDistanceToNow(new Date(ev.event_date), { addSuffix: true })
                              : 'Date unknown'}
                          </span>
                        </div>

                        {/* Title with null safety */}
                        <h4 className="font-semibold text-base leading-tight mb-2">
                          {ev.title ?? 'Untitled Event'}
                        </h4>

                        {/* Show duplicate sources */}
                        {ev.duplicates && ev.duplicates.length > 0 && (
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="text-xs text-muted-foreground">
                              Also reported by:
                            </span>
                            {(showDuplicates ? ev.duplicates : ev.duplicates.slice(0, 3)).map((dup: any, idx: number) => (
                              <a
                                key={idx}
                                href={dup.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs bg-muted px-2 py-1 rounded hover:bg-muted/80 transition-colors"
                              >
                                {dup.source_name}
                              </a>
                            ))}
                            {!showDuplicates && ev.duplicates.length > 3 && (
                              <span className="text-xs text-muted-foreground">
                                +{ev.duplicates.length - 3} more
                              </span>
                            )}
                          </div>
                        )}

                        {/* AI Summary */}
                        {ev.ai_summary && (
                          <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                            {ev.ai_summary}
                          </p>
                        )}

                        {/* Source and actions */}
                        <div className="space-y-2">
                          {ev.canonical_url && (
                            <a
                              href={ev.canonical_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                            >
                              {ev.source_name || 'Read more'}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          <div className="flex gap-3 text-xs text-muted-foreground">
                            <button
                              onClick={() => onReport(ev.event_id ?? undefined)}
                              className="underline hover:text-foreground"
                              aria-label="Report issue with this event"
                            >
                              Report issue
                            </button>
                            <button
                              onClick={onSuggest}
                              className="underline hover:text-foreground"
                              aria-label="Suggest additional evidence"
                            >
                              Suggest evidence
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
              </section>
            ))}
          </div>

          {/* See More button */}
          {hasMore && (
            <div className="pt-4 flex justify-center">
              <button
                onClick={() => setShowAll(!showAll)}
                className="px-6 py-2 rounded-lg border border-border bg-background hover:bg-muted transition-colors text-sm font-medium"
              >
                {showAll 
                  ? 'Show Less' 
                  : `See ${sortedEvidence.length - 5} More Article${sortedEvidence.length - 5 !== 1 ? 's' : ''}`
                }
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
