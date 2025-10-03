import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";

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
            No recent, verified sources in this window. Baseline explains why.
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
                      {source.url && (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          Open
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
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
    </Collapsible>
  );
}
