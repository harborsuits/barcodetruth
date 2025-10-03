import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, ExternalLink, FileText } from "lucide-react";
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
  severity?: string;
  amount?: number;
  verification?: string;
}

const badgeColors: Record<string, string> = {
  'OSHA': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'EPA': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'FEC': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  'FDA': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  'News': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
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
              {sources.map((source) => (
                <div
                  key={source.id}
                  className="p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={`text-xs ${badgeColors[source.badge] || badgeColors.News}`}
                        >
                          {source.badge}
                        </Badge>
                        {source.verification && source.verification !== 'unverified' && (
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            source.verification === 'official'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                          }`}>
                            {source.verification === 'official' ? 'Official' : 'Reported'}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium">{source.title}</p>
                      {source.severity && (
                        <p className="text-xs text-muted-foreground">
                          Severity: {source.severity}
                        </p>
                      )}
                      {source.amount && (
                        <p className="text-xs text-muted-foreground">
                          Amount: ${source.amount.toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(source.occurred_at).toLocaleDateString()}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedSource(source)}
                          className="h-6 text-xs px-2"
                        >
                          <FileText className="h-3 w-3 mr-1" />
                          Details
                        </Button>
                        {source.url && (
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-foreground hover:underline flex items-center gap-1"
                          >
                            Source
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
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
            {selectedSource?.severity && (
              <div>
                <p className="text-sm font-medium mb-1">Severity</p>
                <Badge variant="outline">{selectedSource.severity}</Badge>
              </div>
            )}

            {selectedSource?.amount && (
              <div>
                <p className="text-sm font-medium mb-1">Amount</p>
                <p className="text-lg font-semibold">${selectedSource.amount.toLocaleString()}</p>
              </div>
            )}

            <div>
              <p className="text-sm font-medium mb-2">What Happened</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                This {selectedSource?.badge.toLowerCase()} event was reported by {selectedSource?.source}. 
                {selectedSource?.severity && ` It was classified as ${selectedSource.severity} severity.`}
                {selectedSource?.amount && ` The total amount involved was $${selectedSource.amount.toLocaleString()}.`}
              </p>
            </div>

            {selectedSource?.verification && selectedSource.verification !== 'unverified' && (
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-900 dark:text-green-100">
                  <strong>Verification:</strong> This event is {selectedSource.verification === 'official' ? 'officially documented' : 'corroborated by multiple sources'}.
                </p>
              </div>
            )}

            <div className="pt-4 border-t flex gap-2">
              {selectedSource?.url && (
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={selectedSource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View on {selectedSource.source}
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
