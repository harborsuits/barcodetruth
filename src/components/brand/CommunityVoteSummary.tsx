import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CommunityVoteSummaryProps {
  brandId: string;
}

export function CommunityVoteSummary({ brandId }: CommunityVoteSummaryProps) {
  const { data } = useQuery({
    queryKey: ["community-vote-summary", brandId],
    queryFn: async () => {
      const { data: events } = await supabase
        .from("brand_events")
        .select("upvotes, downvotes")
        .eq("brand_id", brandId)
        .eq("score_eligible", true)
        .gt("upvotes", 0);

      if (!events || events.length === 0) return null;

      const totalEvents = events.length;
      const confirmed = events.filter(e => {
        const total = (e.upvotes || 0) + (e.downvotes || 0);
        return total >= 5 && (e.upvotes || 0) / total >= 0.6;
      }).length;
      const questioned = events.filter(e => {
        const total = (e.upvotes || 0) + (e.downvotes || 0);
        return total >= 5 && (e.upvotes || 0) / total < 0.4;
      }).length;

      return { totalEvents, confirmed, questioned };
    },
    enabled: !!brandId,
  });

  if (!data || data.totalEvents === 0) return null;

  return (
    <p className="text-xs text-muted-foreground">
      {data.confirmed > 0 && (
        <>{data.confirmed} of {data.totalEvents} events confirmed by community</>
      )}
      {data.questioned > 0 && (
        <> · {data.questioned} questioned</>
      )}
    </p>
  );
}
