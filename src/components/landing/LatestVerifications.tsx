import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock } from "lucide-react";

export function LatestVerifications() {
  const { data: recentSources, isLoading } = useQuery({
    queryKey: ["latest-verifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_sources")
        .select("id, source_name, domain_owner, source_date")
        .not("source_date", "is", null)
        .not("domain_owner", "is", null)
        .order("source_date", { ascending: false })
        .limit(8);

      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return "Just now";
  };

  if (isLoading) {
    return (
      <section className="border rounded-2xl p-4 bg-card shadow-sm">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Latest Verifications
        </h3>
        <div className="flex gap-4 overflow-x-auto">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-5 w-32 shrink-0" />
          ))}
        </div>
      </section>
    );
  }

  if (!recentSources || recentSources.length === 0) {
    return null;
  }

  return (
    <section className="border rounded-2xl p-4 bg-card shadow-sm hover:shadow transition-shadow">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Clock className="h-4 w-4 text-primary" />
        Latest Verifications
        <span className="ml-auto text-xs text-muted-foreground font-normal">Swipe to see more →</span>
      </h3>
      <div className="relative -mx-4 px-4">
        {/* Scroll container with smooth scrolling and visible scrollbar */}
        <div 
          className="flex gap-4 overflow-x-auto pb-3 scroll-smooth snap-x snap-mandatory
                     [&::-webkit-scrollbar]:h-1.5
                     [&::-webkit-scrollbar-track]:bg-muted/30 [&::-webkit-scrollbar-track]:rounded-full
                     [&::-webkit-scrollbar-thumb]:bg-primary/40 [&::-webkit-scrollbar-thumb]:rounded-full
                     [&::-webkit-scrollbar-thumb]:hover:bg-primary/60"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'hsl(var(--primary) / 0.4) hsl(var(--muted) / 0.3)' }}
        >
          {recentSources.map((item) => (
            <div 
              key={item.id} 
              className="text-xs shrink-0 flex items-center gap-1.5 snap-start
                         bg-muted/30 px-3 py-1.5 rounded-full
                         hover:bg-muted/50 transition-colors cursor-default"
            >
              <span className="font-medium text-foreground">
                {item.domain_owner || item.source_name}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{timeAgo(item.source_date!)}</span>
            </div>
          ))}
        </div>
        
        {/* Fade gradient on right to indicate more content */}
        <div className="absolute right-0 top-0 bottom-3 w-12 bg-gradient-to-l from-card to-transparent pointer-events-none" />
      </div>
    </section>
  );
}
