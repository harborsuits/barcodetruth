import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, ExternalLink, FileText, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";

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
  url?: string;
  archive_url?: string;
  canonical_url?: string;
  is_generic?: boolean;
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

const credibilityBadges: Record<string, { emoji: string; label: string; color: string }> = {
  'official': { emoji: '🟢', label: 'Official Record', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' },
  'reputable': { emoji: '🔵', label: 'Reputable Media', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  'local': { emoji: '🟠', label: 'Local/Industry', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  'unknown': { emoji: '⚪', label: 'Unverified', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
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

  const sources = allSources;
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
                const dateStr = new Date(source.occurred_at).toLocaleDateString('en-US', { 
                  month: 'short', 
                  year: 'numeric' 
                });

                return (
                  <div
                    key={source.id}
                    className="p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="space-y-2">
                      {/* Outlet header with credibility */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={`text-xs ${badgeColors[source.badge] || badgeColors.News}`}
                        >
                          {source.badge}
                        </Badge>
                        <span className="text-sm font-medium">{source.source}</span>
                        
                        {source.credibility_tier && credibilityBadges[source.credibility_tier] && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            source.credibility_tier === 'official' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : source.credibility_tier === 'reputable'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                              : source.credibility_tier === 'local'
                              ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                          }`}>
                            {credibilityBadges[source.credibility_tier].emoji} {credibilityBadges[source.credibility_tier].label}
                          </span>
                        )}
                        
                        {isArchived && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                            Archived
                          </span>
                        )}

                        <span className="text-xs text-muted-foreground ml-auto">
                          {dateStr}
                        </span>
                      </div>

                      {/* Article title */}
                      {source.article_title && (
                        <p className="text-sm font-semibold">{source.article_title}</p>
                      )}

                      {/* AI Summary */}
                      {source.ai_summary && (
                        <p className="text-sm text-foreground leading-relaxed">
                          {source.ai_summary}
                        </p>
                      )}

                      {/* Metadata row */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                        {source.verification && (
                          <span className={`${
                            source.verification === 'official' 
                              ? 'text-green-600 dark:text-green-400'
                              : source.verification === 'corroborated'
                              ? 'text-blue-600 dark:text-blue-400'
                              : ''
                          }`}>
                            {source.verification}
                          </span>
                        )}
                        
                        {source.severity && (
                          <span className="capitalize">{source.severity}</span>
                        )}
                        
                        {source.amount && (
                          <span className="font-medium">
                            ${source.amount.toLocaleString()}
                          </span>
                        )}
                        
                        <div className="ml-auto flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedSource(source)}
                            className="h-6 text-xs px-2"
                          >
                            <FileText className="h-3 w-3 mr-1" />
                            Details
                          </Button>
                          {linkUrl && !source.is_generic && (
                            <a
                              href={linkUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary"
                            >
                              View
                              <ExternalLink className="h-3 w-3" />
                            </a>
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
                  {selectedSource?.is_generic && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      ⚠️ Generic page - awaiting specific article link
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
                {selectedSource?.url && !selectedSource?.is_generic && (
                  <Button variant="outline" size="sm" asChild className="flex-1">
                    <a
                      href={selectedSource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 justify-center"
                    >
                      <ExternalLink className="h-4 w-4" />
                      View Evidence
                    </a>
                  </Button>
                )}
                {selectedSource?.url && selectedSource?.is_generic && (
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
