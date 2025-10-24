import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatEventTime } from '@/lib/formatTime';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export default function Feed() {
  const { data: allEvents, isLoading } = useQuery({
    queryKey: ['all-events'],
    queryFn: async () => {
      const { data } = await supabase
        .from('brand_events')
        .select(`
          event_id,
          title,
          category,
          event_date,
          created_at,
          source_url,
          brand_id,
          brands (
            id,
            name,
            logo_url
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    }
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Latest Verifications</h1>
        <p className="text-muted-foreground">
          Real-time feed of verified brand events and news
        </p>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          [...Array(10)].map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-20 w-full" />
            </Card>
          ))
        ) : (
          allEvents?.map(event => (
            <Card key={event.event_id} className="p-4 hover:shadow-md transition-shadow">
              <Link to={`/brand/${event.brand_id}`} className="block">
                <div className="flex gap-4">
                  {event.brands?.logo_url && (
                    <img 
                      src={event.brands.logo_url}
                      alt={event.brands.name}
                      className="w-16 h-16 rounded object-contain shrink-0"
                    />
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold line-clamp-2">{event.title}</h3>
                      <Badge variant="outline" className="capitalize shrink-0">
                        {event.category}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="font-medium">{event.brands?.name}</span>
                      <span>•</span>
                      <span>{formatEventTime(event.created_at)}</span>
                    </div>
                  </div>
                </div>
              </Link>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
