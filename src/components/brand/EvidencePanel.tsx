import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertCircle, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getCategoryDisplay } from '@/lib/categoryConfig';

type EvidenceItem = {
  event_id?: string;
  event_date: string;
  title: string;
  verification: string | null;
  source_name: string | null;
  canonical_url: string | null;
  category: string | null;
  category_code?: string | null;
  ai_summary?: string | null;
  secondary_categories?: string[];
  noise_reason?: string;
};

type Props = {
  evidence: EvidenceItem[];
  onReport: (eventId?: string) => void;
  onSuggest: () => void;
};

export function EvidencePanel({ evidence, onReport, onSuggest }: Props) {
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const categoryGroups: Record<string, number> = {
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

  const codeToGroup: Record<string, string> = {
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

  const getGroupName = (code: string | null, legacyCategory: string | null): string => {
    if (code && codeToGroup[code]) {
      return codeToGroup[code];
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

  const getVerificationRank = (v: string | null) =>
    v === 'official' ? 1 : v === 'corroborated' ? 2 : 3;

  const evidenceWithGroups = evidence.map(ev => {
    const groupName = getGroupName(ev.category_code, ev.category);
    return {
      ...ev,
      group_name: groupName,
      group_order: categoryGroups[groupName] ?? 90,
      verification_rank: getVerificationRank(ev.verification)
    };
  });

  const clusterKey = (ev: any) => {
    const normalized = (ev.title || '').trim().toLowerCase();
    const url = ev.canonical_url || '';
    return `${normalized}|${url}`;
  };

  const clusterMap = evidenceWithGroups.reduce((acc, ev) => {
    const key = clusterKey(ev);
    if (!acc[key]) {
      acc[key] = { ...ev, _outlets: new Set(), _count: 0 };
    }
    acc[key]._count++;
    if (ev.source_name) acc[key]._outlets.add(ev.source_name);
    return acc;
  }, {} as Record<string, any>);

  const clusteredEvidence = Object.values(clusterMap);

  const filteredEvidence = categoryFilter === 'all'
    ? clusteredEvidence
    : clusteredEvidence.filter(e => e.group_name === categoryFilter);

  const sortedEvidence = [...filteredEvidence].sort((a, b) => {
    if (a.group_order !== b.group_order) return a.group_order - b.group_order;
    if (a.verification_rank !== b.verification_rank) return a.verification_rank - b.verification_rank;
    return new Date(b.event_date).getTime() - new Date(a.event_date).getTime();
  });

  const grouped = sortedEvidence.reduce((acc, ev) => {
    if (!acc[ev.group_name]) acc[ev.group_name] = [];
    acc[ev.group_name].push(ev);
    return acc;
  }, {} as Record<string, typeof sortedEvidence>);

  const groupOrder = Object.keys(grouped).sort((a, b) =>
    (categoryGroups[a] ?? 90) - (categoryGroups[b] ?? 90)
  );

  return (
    <div className="space-y-4">
      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
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

      {/* Evidence list */}
      {!sortedEvidence.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
          {evidence.length === 0 ? (
            <p className="text-sm">No evidence available yet for this brand.</p>
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
        <div className="space-y-6">
          {groupOrder.map(groupName => (
            <div key={groupName} className="space-y-3">
              {/* Group Header */}
              <div className="flex items-center gap-2 pb-2 border-b">
                <h4 className="font-semibold text-sm">{groupName}</h4>
                <Badge variant="secondary" className="text-xs">
                  {grouped[groupName].length}
                </Badge>
              </div>

              {/* Events */}
              {grouped[groupName].map((ev, idx) => {
                const isOfficial = ev.verification === 'official';
                const isCorroborated = ev.verification === 'corroborated';

                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-lg border transition-colors ${
                      isOfficial ? 'border-destructive/50 bg-destructive/5' :
                      isCorroborated ? 'border-primary/50 bg-primary/5' :
                      'border-border bg-card'
                    }`}
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
                            {formatDistanceToNow(new Date(ev.event_date), { addSuffix: true })}
                          </span>
                        </div>

                        {/* Title */}
                        <h4 className="font-semibold text-base leading-tight mb-2">
                          {ev.title || 'Untitled Event'}
                          {ev._count > 1 && (
                            <span className="ml-2 text-xs border rounded-full px-2 py-0.5 text-muted-foreground">
                              +{ev._count - 1} {ev._count === 2 ? 'outlet' : 'outlets'}
                            </span>
                          )}
                        </h4>

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
                              onClick={() => onReport(ev.event_id)}
                              className="underline hover:text-foreground"
                            >
                              Report issue
                            </button>
                            <button
                              onClick={onSuggest}
                              className="underline hover:text-foreground"
                            >
                              Suggest evidence
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
