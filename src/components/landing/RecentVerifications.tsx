import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatEventTime } from '@/lib/formatTime';
import { Link } from 'react-router-dom';
import { Skeleton } from "@/components/ui/skeleton";

export function RecentVerifications() {
  const { data: recentEvents, isLoading } = useQuery({
    queryKey: ['recent-verifications'],
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
        .limit(10);
      
      return data || [];
    },
    refetchInterval: 60000 // Refresh every minute
  });

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg border p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🔍</span>
          <h3 className="text-lg font-semibold">Latest Verifications</h3>
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🔍</span>
        <h3 className="text-lg font-semibold">Latest Verifications</h3>
        <span className="ml-auto text-xs text-muted-foreground">
          Live feed
        </span>
      </div>
      
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {recentEvents?.map(event => (
          <Link
            key={event.event_id}
            to={`/brand/${event.brand_id}`}
            className="flex gap-3 p-3 hover:bg-accent rounded border transition-colors"
          >
            {/* Company logo */}
            {event.brands?.logo_url && (
              <img 
                src={event.brands.logo_url}
                alt={event.brands.name}
                className="w-10 h-10 rounded object-contain shrink-0"
              />
            )}
            
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium line-clamp-2">{event.title}</div>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                <span>{event.brands?.name}</span>
                <span>•</span>
                <span className="capitalize">{event.category}</span>
                <span>•</span>
                <span>{formatEventTime(event.created_at)}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
      
      <Link 
        to="/feed" 
        className="block mt-4 text-center text-sm text-primary hover:underline"
      >
        View All Verifications →
      </Link>
    </div>
  );
}
