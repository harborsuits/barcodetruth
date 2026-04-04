import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface EventVoteButtonsProps {
  eventId: string;
  upvotes: number;
  downvotes: number;
  compact?: boolean;
}

const DOWNVOTE_REASONS = [
  "This isn't about this brand",
  "This is outdated / no longer relevant",
  "This is misleading or missing context",
  "The impact seems overstated",
];

function communityBadge(up: number, down: number) {
  const total = up + down;
  if (total < 5) return null;
  const ratio = up / total;
  if (ratio >= 0.8) return { label: "Community confirmed", color: "text-success border-success/30" };
  if (ratio <= 0.2) return { label: "Strongly questioned", color: "text-destructive border-destructive/30" };
  if (ratio <= 0.4) return { label: "Questioned", color: "text-warning border-warning/30" };
  return null;
}

export function EventVoteButtons({ eventId, upvotes, downvotes, compact }: EventVoteButtonsProps) {
  const queryClient = useQueryClient();
  const [showReasons, setShowReasons] = useState(false);

  // Fetch user's existing vote
  const { data: myVote } = useQuery({
    queryKey: ["my-vote", eventId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("event_votes")
        .select("vote")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .maybeSingle();
      return data?.vote ?? null;
    },
  });

  const voteMutation = useMutation({
    mutationFn: async ({ vote, reason }: { vote: 1 | -1; reason?: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Sign in to vote"); throw new Error("Not authenticated"); }

      // Toggle: if same vote, remove it
      if (myVote === vote) {
        await supabase.functions.invoke("vote-event", {
          method: "DELETE" as any,
          body: { event_id: eventId },
        });
        return;
      }

      const { error } = await supabase.functions.invoke("vote-event", {
        body: { event_id: eventId, vote, vote_reason: reason },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-vote", eventId] });
      queryClient.invalidateQueries({ queryKey: ["brand-scored-events"] });
      queryClient.invalidateQueries({ queryKey: ["brand-all-events"] });
      setShowReasons(false);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Vote failed");
    },
  });

  const badge = communityBadge(upvotes, downvotes);

  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="ghost"
        size="sm"
        className={`h-7 px-2 text-xs gap-1 ${myVote === 1 ? "text-success bg-success/10" : "text-muted-foreground"}`}
        onClick={() => voteMutation.mutate({ vote: 1 })}
        disabled={voteMutation.isPending}
      >
        <ThumbsUp className="h-3 w-3" />
        {upvotes > 0 && <span>{upvotes}</span>}
      </Button>

      <Popover open={showReasons} onOpenChange={setShowReasons}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 px-2 text-xs gap-1 ${myVote === -1 ? "text-destructive bg-destructive/10" : "text-muted-foreground"}`}
            onClick={() => {
              if (myVote === -1) {
                voteMutation.mutate({ vote: -1 });
              } else {
                setShowReasons(true);
              }
            }}
            disabled={voteMutation.isPending}
          >
            <ThumbsDown className="h-3 w-3" />
            {downvotes > 0 && <span>{downvotes}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <p className="text-xs font-medium mb-2">Why are you questioning this?</p>
          <div className="space-y-1">
            {DOWNVOTE_REASONS.map(reason => (
              <Button
                key={reason}
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs h-8 font-normal"
                onClick={() => voteMutation.mutate({ vote: -1, reason })}
              >
                {reason}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {badge && !compact && (
        <Badge variant="outline" className={`text-[10px] ml-1 ${badge.color}`}>
          {badge.label}
        </Badge>
      )}
    </div>
  );
}
