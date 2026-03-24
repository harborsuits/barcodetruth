import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatEventTime } from '@/lib/formatTime';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, CheckCircle2, Clock, Newspaper } from 'lucide-react';

interface FairFeedItem {
  event_id: string;
  title: string;
  category: string;
  event_date: string | null;
  created_at: string;
  source_url: string | null;
  brand_id: string;
  brand_name: string;
  brand_logo_url: string | null;
  parent_company: string | null;
  materiality_score: number;
}

export default function Feed() {
  const { data: feedItems, isLoading } = useQuery({
    queryKey: ['fair-feed'],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_fair_feed', {
        p_limit: 50,
        p_max_per_brand: 3,
      });
      if (error) throw error;
      return (data || []) as unknown as FairFeedItem[];
    },
  });

  const materialityLabel = (score: number) => {
    if (score >= 2) return { text: 'High impact', variant: 'destructive' as const };
    if (score >= 0.5) return { text: 'Material', variant: 'default' as const };
    return { text: 'Minor', variant: 'secondary' as const };
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Latest Verifications</h1>
        <p className="text-muted-foreground">
          Fair, material news — capped at 3 items per brand, ranked by impact
        </p>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          [...Array(10)].map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-20 w-full" />
            </Card>
          ))
        ) : feedItems && feedItems.length > 0 ? (
          feedItems.map((event) => {
            const mat = materialityLabel(event.materiality_score);
            return (
              <Card key={event.event_id} className="p-4 hover:shadow-md transition-shadow">
                <Link to={`/brand/${event.brand_id}`} className="block">
                  <div className="flex gap-4">
                    {event.brand_logo_url && (
                      <img
                        src={event.brand_logo_url}
                        alt={event.brand_name}
                        className="w-16 h-16 rounded object-contain shrink-0"
                      />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold line-clamp-2">{event.title}</h3>
                        <div className="flex gap-1.5 shrink-0">
                          <Badge variant={mat.variant} className="text-xs">
                            {mat.text}
                          </Badge>
                          <Badge variant="outline" className="capitalize text-xs">
                            {event.category}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="font-medium">{event.brand_name}</span>
                        {event.parent_company && event.parent_company !== event.brand_name && (
                          <>
                            <span>·</span>
                            <span className="text-xs">{event.parent_company}</span>
                          </>
                        )}
                        <span>•</span>
                        <span>{formatEventTime(event.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              </Card>
            );
          })
        ) : (
          <Card className="p-8 text-center">
            <Newspaper className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">No recent material events</p>
            <p className="text-sm text-muted-foreground mt-1">
              We continuously check brands for material news. Nothing significant in the last 30 days.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
