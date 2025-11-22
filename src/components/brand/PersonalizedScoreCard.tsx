import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface PersonalizedScoreCardProps {
  personalizedScore: number | null;
  baselineScore: number | null;
}

export function PersonalizedScoreCard({
  personalizedScore,
  baselineScore,
}: PersonalizedScoreCardProps) {
  const navigate = useNavigate();
  
  // Fetch user + preferences in here so the card can decide copy cleanly
  const { data: session } = useQuery({
    queryKey: ['supabase-session'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session ?? null;
    },
  });

  const user = session?.user ?? null;

  const { data: prefs } = useQuery({
    queryKey: ['user-value-preferences', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('user_profiles')
        .select('cares_labor, cares_environment, cares_politics, cares_social')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('[PersonalizedScoreCard] Error loading user preferences:', error);
        return null;
      }
      
      console.log('[PersonalizedScoreCard] User preferences loaded:', data);
      return data;
    },
  });

  // Decide what we actually show
  const hasPersonalized = user && prefs && typeof personalizedScore === 'number';
  const effectiveScore = (hasPersonalized ? personalizedScore : baselineScore) ?? null;

  if (effectiveScore === null) {
    return (
      <Card className="p-4 sm:p-6">
        <p className="font-medium mb-1">Score status</p>
        <p className="text-sm text-muted-foreground">
          Monitoring in progress — this brand's ethical score will appear once
          enough verified events are collected.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4 sm:p-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium text-muted-foreground">
          {hasPersonalized ? 'Your ethical score' : 'Baseline ethical score'}
        </p>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-4xl font-semibold">
            {Math.round(effectiveScore)}
          </span>
          <span className="text-sm text-muted-foreground">/100</span>
        </div>

        {hasPersonalized && (
          <p className="mt-2 text-sm text-muted-foreground">
            Baseline score:{' '}
            <span className="font-medium">
              {Math.round(baselineScore ?? 50)}/100
            </span>
            <br />
            Based on your values – Labor {prefs.cares_labor}, Environment{' '}
            {prefs.cares_environment}, Politics {prefs.cares_politics}, Social{' '}
            {prefs.cares_social}. Two people with different values will see
            different scores for the same brand.
          </p>
        )}

        {!hasPersonalized && (
          <p className="mt-2 text-sm text-muted-foreground">
            This is the neutral baseline score based on objective events
            we've collected so far.
          </p>
        )}
      </div>

      {!hasPersonalized && (
        <div className="mt-3 sm:mt-0">
          <Button size="sm" onClick={() => navigate('/settings')}>
            Set your values to personalize this score
          </Button>
        </div>
      )}
    </Card>
  );
}
