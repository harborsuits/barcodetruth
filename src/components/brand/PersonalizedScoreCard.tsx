import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface PersonalizedScoreCardProps {
  personalizedScore: number | null;
  baselineScore: number | null;
  userPreferences?: {
    cares_labor: number;
    cares_environment: number;
    cares_politics: number;
    cares_social: number;
  } | null;
}

export function PersonalizedScoreCard({
  personalizedScore,
  baselineScore,
  userPreferences,
}: PersonalizedScoreCardProps) {
  const navigate = useNavigate();
  
  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      return session;
    }
  });
  
  const user = session?.user;

  const displayScore = personalizedScore ?? baselineScore ?? null;

  if (displayScore === null) {
    return (
      <Card className="p-6 bg-gradient-to-r from-muted/50 to-muted/30">
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-muted-foreground">
            Score Status
          </h3>
          <p className="text-sm text-muted-foreground">
            Monitoring in progress — this brand's ethical score will appear once
            enough verified events are collected.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-gradient-to-r from-primary/5 via-background to-primary/5 border-2">
      <div className="space-y-4">
        {/* Main Score Display */}
        <div className="text-center">
          <div className="text-sm text-muted-foreground mb-2">
            {user && personalizedScore !== null ? "Your Ethical Score" : "Baseline Ethical Score"}
          </div>
          <div className="text-6xl font-bold text-foreground">
            {Math.round(displayScore)}
            <span className="text-3xl text-muted-foreground">/100</span>
          </div>
        </div>

        {/* Personalized Info */}
        {user && personalizedScore !== null && userPreferences ? (
          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Baseline Score:</span>
              <span className="font-semibold">{Math.round(baselineScore ?? 50)}/100</span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium">Based on your values:</p>
              <div className="grid grid-cols-2 gap-2">
                <div>Labor: {userPreferences.cares_labor}</div>
                <div>Environment: {userPreferences.cares_environment}</div>
                <div>Politics: {userPreferences.cares_politics}</div>
                <div>Social: {userPreferences.cares_social}</div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground italic text-center pt-2 border-t">
              Scores are personalized — two people with different values will see different scores for the same brand.
            </p>
          </div>
        ) : (
          <div className="border-t pt-4 text-center">
            <p className="text-sm text-muted-foreground mb-3">
              This is the neutral baseline score based on objective events.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/settings")}
            >
              Set Your Values to Personalize This Score
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
