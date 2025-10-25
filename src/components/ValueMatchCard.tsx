import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { calculateValueMatch, MatchResult } from "@/lib/calculateMatch";
import { useCategoryEvidence } from "@/hooks/useCategoryEvidence";
import { ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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
  brandId: string;
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

function CategoryEvidence({ brandId, category }: { brandId: string; category: string }) {
  const { data: evidence, isLoading } = useCategoryEvidence(brandId, category as any);
  
  // Only show evidence if we have data AND it matches the requested category
  if (isLoading || !evidence || evidence.length === 0) return null;
  
  // Extra safety: filter to ensure all evidence matches the category
  const validEvidence = evidence.filter(ev => ev.category === category);
  if (validEvidence.length === 0) return null;
  
  return (
    <div className="mt-3 pt-3 border-t border-border/50">
      <p className="text-xs font-medium text-muted-foreground mb-2">Evidence:</p>
      <div className="space-y-2">
        {validEvidence.map((ev) => (
          <a
            key={ev.event_id}
            href={ev.source_url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-2 text-xs hover:bg-muted/50 p-2 rounded transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground group-hover:text-primary line-clamp-2 leading-tight">
                {ev.title}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={ev.verification === 'official' ? 'destructive' : 'outline'} className="text-[10px] px-1.5 py-0">
                  {ev.verification === 'official' ? 'Official' : ev.verification === 'corroborated' ? 'Verified' : 'Reported'}
                </Badge>
                <span className="text-muted-foreground">
                  {formatDistanceToNow(new Date(ev.event_date), { addSuffix: true })}
                </span>
              </div>
            </div>
            <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-primary flex-shrink-0 mt-0.5" />
          </a>
        ))}
      </div>
    </div>
  );
}

export function ValueMatchCard({ userValues, brandScores, brandName, brandId }: ValueMatchCardProps) {
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
                  <CategoryEvidence brandId={brandId} category={key} />
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
