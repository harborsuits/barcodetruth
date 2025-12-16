import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatEventTime } from '@/lib/formatTime';
import { Link, useNavigate } from 'react-router-dom';
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink } from 'lucide-react';

export function RecentVerifications() {
  const navigate = useNavigate();
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
    refetchInterval: 60000
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
          <div
            key={event.event_id}
            onClick={() => navigate(`/brand/${event.brand_id}`)}
            className="cursor-pointer rounded-lg border p-4 hover:bg-muted transition"
          >
            {/* Company logo */}
            {event.brands?.logo_url && (
              <img
                src={event.brands.logo_url}
                alt={event.brands.name}
                className="h-8 w-8 rounded mb-2 object-contain"
              />
            )}

            {/* Title */}
            <div className="font-medium line-clamp-2">
              {event.title}
            </div>

            {/* Meta row */}
            <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-1 mt-1">
              <span>{event.brands?.name}</span>
              <span>•</span>
              <span className="capitalize">{event.category}</span>
              <span>•</span>
              <span>{formatEventTime(event.created_at)}</span>

              {event.source_url && (
                <>
                  <span>•</span>
                  <a
                    href={event.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    View source
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </>
              )}
            </div>
          </div>
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
