import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

interface FeedEvent {
  event_id: string;
  brand_id: string;
  brand_name: string;
  title: string;
  description?: string;
  category: string;
  category_code?: string;
  verification: string;
  event_date: string;
  source_url?: string;
  severity?: string;
  orientation?: string;
  is_parent_entity: boolean;
}

export function SubsidiaryFeed({ brandId }: { brandId: string }) {
  const [includeSubsidiaries, setIncludeSubsidiaries] = useState(false);

  const { data: events, isLoading } = useQuery({
    queryKey: ['subsidiary-feed', brandId, includeSubsidiaries],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_brand_feed_with_subsidiaries' as any, {
        p_brand_id: brandId,
        p_include_subsidiaries: includeSubsidiaries,
        p_limit: 50,
      });
      if (error) throw error;
      return data as unknown as FeedEvent[];
    },
  });

  // Check if this brand has any subsidiaries
  const { data: hasSubsidiaries } = useQuery({
    queryKey: ['has-subsidiaries', brandId],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_ownership_graph' as any, {
        p_brand_id: brandId,
      });
      const graph = data as any;
      return (graph?.edges || []).some((e: any) => e.from === brandId);
    },
  });

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      labor: 'bg-blue-500',
      environment: 'bg-green-500',
      politics: 'bg-purple-500',
      social: 'bg-orange-500',
    };
    return colors[category] || 'bg-gray-500';
  };

  const getVerificationColor = (verification: string) => {
    const colors: Record<string, string> = {
      official: 'bg-emerald-500',
      corroborated: 'bg-blue-500',
      unverified: 'bg-gray-500',
    };
    return colors[verification] || 'bg-gray-500';
  };

  return (
    <div className="space-y-4">
      {hasSubsidiaries && (
        <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
          <div className="space-y-0.5">
            <Label htmlFor="include-subsidiaries" className="text-base">
              Include subsidiaries
            </Label>
            <p className="text-sm text-muted-foreground">
              Show events from all owned entities
            </p>
          </div>
          <Switch
            id="include-subsidiaries"
            checked={includeSubsidiaries}
            onCheckedChange={setIncludeSubsidiaries}
          />
        </div>
      )}

      <div className="space-y-3">
        {isLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-20 w-full" />
              </Card>
            ))}
          </>
        ) : events && events.length > 0 ? (
          events.map((event) => (
            <Card key={event.event_id} className="p-4 hover:bg-accent/50 transition-colors">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-2">
                    {!event.is_parent_entity && (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {event.brand_name}
                        </span>
                      </div>
                    )}
                    <h4 className="font-medium leading-tight">{event.title}</h4>
                    {event.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {event.description}
                      </p>
                    )}
                  </div>
                  {event.source_url && (
                    <a
                      href={event.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {format(new Date(event.event_date), 'MMM d, yyyy')}
                  </Badge>
                  <Badge className={getCategoryColor(event.category)}>
                    {event.category}
                  </Badge>
                  <Badge variant="outline" className={getVerificationColor(event.verification)}>
                    {event.verification}
                  </Badge>
                  {event.category_code && (
                    <Badge variant="outline" className="text-xs">
                      {event.category_code}
                    </Badge>
                  )}
                  {event.severity && (
                    <Badge variant="destructive" className="text-xs">
                      {event.severity}
                    </Badge>
                  )}
                </div>
              </div>
            </Card>
          ))
        ) : (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No events found</p>
          </Card>
        )}
      </div>
    </div>
  );
}
