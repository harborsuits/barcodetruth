import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Bell, TrendingUp, Activity, CheckCircle } from "lucide-react";

interface PersonalizedScoreCardProps {
  personalizedScore: number | null;
  baselineScore: number | null;
  eventsCount?: number;
  hasEthicalImpact?: boolean;
}

export function PersonalizedScoreCard({
  personalizedScore,
  baselineScore,
  eventsCount = 0,
  hasEthicalImpact = false,
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
  const hasPersonalized = user && typeof personalizedScore === 'number';
  const effectiveScore = (hasPersonalized ? personalizedScore : baselineScore) ?? null;

  // Status-based messaging when no score
  if (effectiveScore === null) {
    // Case 1: No events at all - collection starting
    if (eventsCount === 0) {
      return (
        <Card className="p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-muted">
              <Activity className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-medium">Collection Starting</p>
                <Badge variant="outline" className="text-xs">In Progress</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                We haven't collected events for this brand yet. Follow to be notified when data becomes available.
              </p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate('/settings')}>
                <Bell className="h-4 w-4 mr-2" />
                Follow this brand
              </Button>
            </div>
          </div>
        </Card>
      );
    }
    
    // Case 2: Events exist but no ethical impacts (market news only)
    if (eventsCount > 0 && !hasEthicalImpact) {
      return (
        <Card className="p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-green-100 dark:bg-green-950">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-medium">Neutral Activity</p>
                <Badge variant="secondary" className="text-xs">{eventsCount} events</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                We found {eventsCount} recent event{eventsCount !== 1 ? 's' : ''} but none indicate ethical concerns 
                in labor, environment, politics, or social categories. This is generally a good sign.
              </p>
            </div>
          </div>
        </Card>
      );
    }
    
    // Case 3: Events with impacts but score not yet calculated
    return (
      <Card className="p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-950">
            <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-medium">Building Score</p>
              <Badge variant="outline" className="text-xs">Early Data</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              We're analyzing {eventsCount} event{eventsCount !== 1 ? 's' : ''} to calculate an ethical score. 
              Check back soon for a complete assessment.
            </p>
          </div>
        </div>
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

        {hasPersonalized && prefs && (
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
