import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { calculateValueMatch, MatchResult } from "@/lib/calculateMatch";

interface ValueMatchCardProps {
  userValues: {
    value_labor: number;
    value_environment: number;
    value_politics: number;
    value_social: number;
  };
  brandScores: {
    score_labor: number;
    score_environment: number;
    score_politics: number;
    score_social: number;
  };
  brandName: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  labor: "Worker Rights",
  environment: "Environmental Impact",
  politics: "Political Influence",
  social: "Social Values"
};

const CATEGORY_DESCRIPTIONS: Record<string, { user: (val: number) => string; brand: (val: number) => string }> = {
  labor: {
    user: (val) => val > 70 ? "You prioritize worker rights" : val < 30 ? "You don't focus on labor issues" : "You're neutral on worker rights",
    brand: (val) => val > 70 ? "strong labor practices" : val < 30 ? "poor labor record" : "moderate labor practices"
  },
  environment: {
    user: (val) => val > 70 ? "You care deeply about sustainability" : val < 30 ? "You don't prioritize environmental issues" : "You're neutral on environment",
    brand: (val) => val > 70 ? "strong environmental commitment" : val < 30 ? "poor environmental record" : "moderate environmental practices"
  },
  politics: {
    user: (val) => val > 70 ? "You care about corporate political influence" : val < 30 ? "You don't mind corporate lobbying" : "You're neutral on politics",
    brand: (val) => val > 70 ? "heavily involved in politics" : val < 30 ? "minimal political activity" : "moderate political involvement"
  },
  social: {
    user: (val) => val > 70 ? "You prefer progressive, diverse companies" : val < 30 ? "You prefer traditional values" : "You're neutral on social issues",
    brand: (val) => val > 70 ? "very progressive (strong DEI/LGBTQ initiatives)" : val < 30 ? "traditional approach" : "moderate social stance"
  }
};

export function ValueMatchCard({ userValues, brandScores, brandName }: ValueMatchCardProps) {
  const matchAnalysis = calculateValueMatch(userValues, brandScores);

  return (
    <Card className="border-2">
      <div className="p-6">
        {/* Overall Match Score */}
        <div className="text-center mb-6 pb-6 border-b">
          <div className={`text-6xl font-bold mb-2 ${
            matchAnalysis.recommendation === 'aligned' ? 'text-success' :
            matchAnalysis.recommendation === 'misaligned' ? 'text-danger' :
            'text-muted-foreground'
          }`}>
            {matchAnalysis.overall_match}%
          </div>
          <div className="text-lg font-semibold mb-1">
            {matchAnalysis.recommendation === 'aligned' && '✓ Values Match'}
            {matchAnalysis.recommendation === 'neutral' && '~ Partial Match'}
            {matchAnalysis.recommendation === 'misaligned' && '⚠️ Values Mismatch'}
          </div>
          <p className="text-sm text-muted-foreground">
            Based on your personal values
          </p>
        </div>
        
        {/* Category Breakdown */}
        <div className="space-y-4">
          <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
            Why This Matters to You
          </h4>
          {Object.entries(matchAnalysis.category_matches)
            .filter(([_, match]) => match.userCares)
            .map(([key, match]) => {
              const userValue = userValues[`value_${key}` as keyof typeof userValues];
              const brandValue = brandScores[`score_${key}` as keyof typeof brandScores];
              
              return (
                <div key={key} className="space-y-2 p-4 rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{CATEGORY_LABELS[key]}</span>
                    <Badge 
                      variant={
                        match.severity === 'major_mismatch' ? 'destructive' :
                        match.severity === 'moderate_mismatch' ? 'outline' :
                        match.severity === 'good_match' ? 'default' :
                        'secondary'
                      }
                      className={
                        match.severity === 'moderate_mismatch' ? 'border-orange-500 text-orange-700' : ''
                      }
                    >
                      {match.severity === 'major_mismatch' && '⚠️ Major Issue'}
                      {match.severity === 'moderate_mismatch' && '⚡ Concern'}
                      {match.severity === 'minor_mismatch' && '~ Slight Gap'}
                      {match.severity === 'good_match' && '✓ Match'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {CATEGORY_DESCRIPTIONS[key].user(userValue)}, but {brandName} has{' '}
                    {CATEGORY_DESCRIPTIONS[key].brand(brandValue)}.
                    <span className="font-medium text-foreground"> {match.gap} point gap.</span>
                  </p>
                </div>
              );
            })}
          
          {Object.values(matchAnalysis.category_matches).every(m => !m.userCares) && (
            <p className="text-sm text-muted-foreground text-center py-4">
              You haven't set strong preferences yet. <a href="/settings" className="underline">Update your values</a> to see personalized matches.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
