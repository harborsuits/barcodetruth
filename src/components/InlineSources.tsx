import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, ExternalLink, FileText, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { format } from "date-fns";

interface InlineSourcesProps {
  brandId: string;
  category: string;
  categoryLabel: string;
}

interface Source {
  id: string;
  occurred_at: string;
  title: string;
  badge: string;
  source: string;
  source_date?: string;
  url?: string;
  archive_url?: string;
  canonical_url?: string;
  link_kind?: 'article' | 'database' | 'homepage';
  severity?: string;
  amount?: number;
  verification?: string;
  credibility_tier?: 'official' | 'reputable' | 'local' | 'unknown';
  ai_summary?: string;
  article_title?: string;
}

const badgeColors: Record<string, string> = {
  'OSHA': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'EPA': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'FEC': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  'FDA': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  'News': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
};

const getCredibilityEmoji = (tier?: string): string => {
  switch (tier) {
    case 'official': return '🟢';
    case 'reputable': return '🔵';
    case 'local': return '🟠';
    default: return '⚪';
  }
};

const getCredibilityVariant = (tier?: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (tier) {
    case 'official': return 'default';
    case 'reputable': return 'secondary';
    default: return 'outline';
  }
};

export function InlineSources({ brandId, category, categoryLabel }: InlineSourcesProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [allSources, setAllSources] = useState<Source[]>([]);
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['brand-sources', brandId, category, cursor],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-brand-sources', {
        body: { brandId, category, limit: 8, cursor }
      });
      if (error) throw error;
      return data as { items: Source[]; nextCursor?: string | null };
    },
    enabled: isOpen && !!brandId,
    staleTime: 120000, // 2 minutes
  });

  // Reset pagination when category changes
  useEffect(() => {
    setCursor(null);
    setAllSources([]);
  }, [category]);

  // Accumulate sources as we paginate, or reset when opening/changing category
  useEffect(() => {
    if (!isOpen) {
      setAllSources([]);
      setCursor(null);
    } else if (data?.items) {
      if (cursor) {
        setAllSources(prev => [...prev, ...data.items]);
      } else {
        setAllSources(data.items);
      }
    }
  }, [isOpen, data, cursor]);

  // Sort by credibility: reputable → official → local → unknown
  const credibilityOrder = { 'reputable': 0, 'official': 1, 'local': 2, 'unknown': 3 };
  const sources = [...allSources].sort((a, b) => {
    const orderA = credibilityOrder[a.credibility_tier as keyof typeof credibilityOrder] ?? 4;
    const orderB = credibilityOrder[b.credibility_tier as keyof typeof credibilityOrder] ?? 4;
    return orderA - orderB;
  });
  const hasMore = !!data?.nextCursor;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between mt-2 text-xs"
        >
          <span className="text-muted-foreground">
            {isOpen ? 'Hide sources' : 'View sources'}
          </span>
          {isOpen ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-3 space-y-2">
        {isLoading && (
          <div className="text-sm text-muted-foreground text-center py-4">
            Loading sources...
          </div>
        )}

        {error && (
          <div className="text-sm text-destructive text-center py-4">
            Failed to load sources
          </div>
        )}

        {!isLoading && !error && sources.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-4">
            No recent, verified sources in this window. Try widening the time window or checking other categories.
          </div>
        )}

        {!isLoading && !error && sources.length > 0 && (
          <>
            <div className="space-y-2">
              {sources.map((source) => {
                const isArchived = !!source.archive_url;
                const linkUrl = source.url || source.archive_url;
                const dateStr = source.source_date 
                  ? format(new Date(source.source_date), 'MMM yyyy')
                  : format(new Date(source.occurred_at), 'MMM yyyy');

                return (
                  <div
                    key={source.id}
                    className="p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-xl">{getCredibilityEmoji(source.credibility_tier)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap text-sm">
                            <span className="font-medium">
                              {source.source || 'Unknown Source'}
                            </span>
                            {dateStr && (
                              <>
                                <span className="text-muted-foreground">·</span>
                                <span className="text-muted-foreground">{dateStr}</span>
                              </>
                            )}
                            {isArchived && (
                              <>
                                <span className="text-muted-foreground">·</span>
                                <Badge variant="secondary" className="text-xs shrink-0">
                                  Archived
                                </Badge>
                              </>
                            )}
                            <Badge variant={getCredibilityVariant(source.credibility_tier)} className="text-xs shrink-0">
                              {source.credibility_tier || 'Unknown'}
                            </Badge>
                          </div>
                          
                          {source.article_title && (
                            <p className="text-sm text-foreground/90 mt-1 line-clamp-2">
                              {source.article_title}
                            </p>
                          )}
                          
                          {source.ai_summary && (
                            <p className="text-sm text-muted-foreground mt-2">
                              {source.ai_summary}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Metadata and actions */}
                      <div className="flex items-center gap-2 pt-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-1">
                          {source.severity && (
                            <Badge variant="outline" className="text-xs capitalize">
                              {source.severity}
                            </Badge>
                          )}
                          {source.amount && (
                            <span className="font-medium">
                              ${source.amount.toLocaleString()}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex gap-1">
                          {source.link_kind === 'article' && source.canonical_url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              asChild
                              className="h-7 text-xs px-2"
                            >
                              <a
                                href={source.canonical_url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                View Article
                              </a>
                            </Button>
                          )}
                          {source.link_kind === 'database' && linkUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              asChild
                              className="h-7 text-xs px-2"
                            >
                              <a
                                href={linkUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                View Database
                              </a>
                            </Button>
                          )}
                          {source.link_kind === 'homepage' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled
                              className="h-7 text-xs px-2 opacity-50"
                            >
                              Article pending
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {hasMore && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => setCursor(data?.nextCursor!)}
                disabled={isLoading}
              >
                {isLoading ? 'Loading...' : 'Show more'}
              </Button>
            )}
          </>
        )}
      </CollapsibleContent>

      {/* Source Detail Modal */}
      <Dialog open={!!selectedSource} onOpenChange={() => setSelectedSource(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge variant="outline" className={`text-xs ${badgeColors[selectedSource?.badge || 'News'] || badgeColors.News}`}>
                {selectedSource?.badge}
              </Badge>
              {selectedSource?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedSource?.occurred_at && (
                <span className="text-sm">
                  {new Date(selectedSource.occurred_at).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

            <div className="space-y-4 pt-4">
              <div className="flex items-start gap-2 text-xs text-muted-foreground pb-3 border-b">
                <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">From: {selectedSource?.source}</p>
                  {selectedSource?.url && (
                    <p className="text-xs">
                      {(() => {
                        try {
                          return new URL(selectedSource.url).hostname;
                        } catch {
                          return selectedSource.url;
                        }
                      })()}
                    </p>
                  )}
                  {selectedSource?.link_kind === 'homepage' && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      ⚠️ Article pending - homepage reference
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {selectedSource?.severity && (
                  <div>
                    <p className="text-xs font-medium mb-1 text-muted-foreground">Severity</p>
                    <Badge variant="outline">{selectedSource.severity}</Badge>
                  </div>
                )}

                {selectedSource?.amount && (
                  <div>
                    <p className="text-xs font-medium mb-1 text-muted-foreground">Amount</p>
                    <p className="text-base font-semibold">${selectedSource.amount.toLocaleString()}</p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Event Summary</p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  This {selectedSource?.badge.toLowerCase()} event was reported by {selectedSource?.source}. 
                  {selectedSource?.severity && ` It was classified as ${selectedSource.severity} severity.`}
                  {selectedSource?.amount && ` The total amount involved was $${selectedSource.amount.toLocaleString()}.`}
                </p>
              </div>

              {selectedSource?.verification && selectedSource.verification !== 'unverified' && (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                  <p className="text-xs font-medium text-emerald-900 dark:text-emerald-100 mb-1">
                    ✓ Verification Status
                  </p>
                  <p className="text-sm text-emerald-900 dark:text-emerald-100">
                    This event is {selectedSource.verification === 'official' ? 'officially documented' : 'corroborated by multiple sources'}.
                  </p>
                </div>
              )}

              <div className="pt-4 border-t flex gap-2">
                {selectedSource?.url && selectedSource?.link_kind === 'article' && (
                  <Button variant="outline" size="sm" asChild className="flex-1">
                    <a
                      href={selectedSource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 justify-center"
                    >
                      <ExternalLink className="h-4 w-4" />
                      View Article
                    </a>
                  </Button>
                )}
                {selectedSource?.url && selectedSource?.link_kind === 'database' && (
                  <Button variant="outline" size="sm" asChild className="flex-1">
                    <a
                      href={selectedSource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 justify-center"
                    >
                      <ExternalLink className="h-4 w-4" />
                      View Database
                    </a>
                  </Button>
                )}
                {selectedSource?.url && selectedSource?.link_kind === 'homepage' && (
                  <Button variant="outline" size="sm" asChild className="flex-1">
                    <a
                      href={selectedSource.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="flex items-center gap-2 justify-center"
                    >
                      <ExternalLink className="h-4 w-4" />
                      View Outlet
                    </a>
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setSelectedSource(null)}>
                  Close
                </Button>
              </div>
            </div>
        </DialogContent>
      </Dialog>
    </Collapsible>
  );
}
