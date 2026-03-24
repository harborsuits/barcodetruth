import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatEventTime } from '@/lib/formatTime';
import { Link, useNavigate } from 'react-router-dom';
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from 'lucide-react';

function getMaterialityBadge(category: string) {
  const cat = (category || '').toLowerCase();
  if (['labor', 'environment'].includes(cat)) {
    return { label: 'MATERIAL', className: 'bg-warning/20 text-warning border-warning/30' };
  }
  if (cat === 'politics') {
    return { label: 'HIGH MATERIAL', className: 'bg-destructive/20 text-destructive border-destructive/30' };
  }
  return { label: 'MINOR', className: 'bg-muted text-muted-foreground border-border' };
}

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
            logo_url,
            status
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
      <section className="space-y-3">
        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">RECENT VERIFICATIONS</div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">RECENT VERIFICATIONS</span>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
          <span className="h-1.5 w-1.5 bg-success rounded-full animate-pulse" />
          Live Feed
        </span>
      </div>
      
      <div className="space-y-2">
        {recentEvents?.map(event => {
          const materiality = getMaterialityBadge(event.category);
          return (
            <div
              key={event.event_id}
              onClick={() => navigate(`/brand/${event.brand_id}`)}
              className="cursor-pointer bg-elevated-1 border border-border p-4 hover:border-primary/30 transition-colors space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium text-sm line-clamp-2 flex-1">
                  {event.title}
                </div>
                <Badge variant="outline" className={`${materiality.className} text-[9px] font-mono uppercase tracking-wider flex-shrink-0 px-2 py-0.5`}>
                  {materiality.label}
                </Badge>
              </div>

              <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                <span>{event.brands?.name}</span>
                <span className="text-border">·</span>
                <span className="capitalize">{event.category}</span>
                <span className="text-border">·</span>
                <span>{formatEventTime(event.created_at)}</span>
                {event.source_url && (
                  <>
                    <span className="text-border">·</span>
                    <a
                      href={event.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      SOURCE_DATA
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      <Link 
        to="/feed" 
        className="block text-center font-mono text-xs uppercase tracking-wider text-primary hover:underline py-2"
      >
        View All Verifications →
      </Link>
    </section>
  );
}
