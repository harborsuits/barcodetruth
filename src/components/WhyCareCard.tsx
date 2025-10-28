import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, TrendingUp, TrendingDown } from "lucide-react";
import { WhyCareBullet } from "@/lib/whyCare";
import { describePoliticsMismatch } from "@/lib/politicsExplain";
import { FEATURES } from "@/lib/featureFlags";

interface WhyCareCardProps {
  bullets: WhyCareBullet[];
  onShowEvidence?: (category: string) => void;
  userPoliticalIntensity?: number;
  userPoliticalAlignment?: number;
  brandPoliticsIntensity?: number | null;
  brandPoliticsAlignment?: number | null;
}

export function WhyCareCard({ 
  bullets, 
  onShowEvidence,
  userPoliticalIntensity,
  userPoliticalAlignment,
  brandPoliticsIntensity,
  brandPoliticsAlignment
}: WhyCareCardProps) {
  // Get politics-specific mismatch if available (gated by feature flag)
  const politicsMismatch = 
    FEATURES.POLITICS_TWO_AXIS &&
    userPoliticalIntensity !== undefined && 
    userPoliticalAlignment !== undefined
      ? describePoliticsMismatch(
          userPoliticalIntensity,
          userPoliticalAlignment,
          brandPoliticsIntensity,
          brandPoliticsAlignment
        )
      : null;

  if (bullets.length === 0 && !politicsMismatch) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Set your value priorities in Settings to see personalized insights.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Why this score matters to you</h3>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {politicsMismatch && (
          <div className="flex gap-2 pb-3 border-b">
            <div className="mt-0.5">
              <Info className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-foreground">
                {politicsMismatch}
              </p>
              {onShowEvidence && (
                <button
                  onClick={() => onShowEvidence('politics')}
                  className="text-xs text-primary hover:underline mt-1"
                >
                  Show evidence →
                </button>
              )}
            </div>
          </div>
        )}
        
        {bullets.map((bullet) => (
          <div key={bullet.category} className="flex gap-2">
            <div className="mt-0.5">
              {bullet.direction === 'higher' ? (
                <TrendingUp className="h-4 w-4 text-orange-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-blue-500" />
              )}
            </div>
            <div className="flex-1 space-y-1">
              <div className="text-sm">
                <span className="font-medium">{bullet.gap}-point gap</span>
                {' on '}
                <span className="text-muted-foreground">{bullet.label}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {bullet.explanation}
              </p>
              {onShowEvidence && (
                <button
                  onClick={() => onShowEvidence(bullet.category)}
                  className="text-xs text-primary hover:underline"
                >
                  Show evidence →
                </button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
