import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { analytics } from "@/lib/analytics";

interface Alternative {
  brand_id: string;
  brand_name: string;
  valueFit: number;
  overall_score: number;
  why: string;
  price_context?: string;
}

interface BetterAlternativesCardProps {
  alternatives: Alternative[];
  currentMatch: number;
  currentBrandId?: string;
  onCompare?: (brandId: string) => void;
}

function getMatchColor(match: number): string {
  if (match >= 80) return 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20';
  if (match >= 70) return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
  return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20';
}

export function BetterAlternativesCard({ 
  alternatives, 
  currentMatch,
  currentBrandId,
  onCompare 
}: BetterAlternativesCardProps) {
  const navigate = useNavigate();
  
  // Only show alternatives that are better matches
  const betterAlts = alternatives.filter(alt => alt.valueFit > currentMatch);
  
  if (betterAlts.length === 0) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Higher-Aligned Alternatives</h3>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          These brands align more closely with your priorities ({betterAlts.length} found)
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {betterAlts.slice(0, 3).map((alt) => {
          const improvement = alt.valueFit - currentMatch;
          
          return (
            <div 
              key={alt.brand_id}
              className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1">
                  <div className="font-medium text-sm mb-1">{alt.brand_name}</div>
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${getMatchColor(alt.valueFit)}`}
                  >
                    {alt.valueFit}% match
                    <span className="ml-1 text-[0.65rem] opacity-75">
                      (+{improvement})
                    </span>
                  </Badge>
                </div>
              </div>
              
              <ul className="text-xs text-muted-foreground space-y-0.5 mb-3">
                {alt.why.split('.').slice(0, 2).filter(Boolean).map((reason, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{reason.trim()}</span>
                  </li>
                ))}
              </ul>
              
              {alt.price_context && (
                <p className="text-xs text-muted-foreground mb-2">
                  {alt.price_context}
                </p>
              )}
              
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-8 text-xs"
                  onClick={() => {
                    analytics.trackAlternativeClicked(
                      currentBrandId || '',
                      alt.brand_id,
                      improvement
                    );
                    navigate(`/brand/${alt.brand_id}`);
                  }}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  View Brand
                </Button>
                {onCompare && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs"
                    onClick={() => onCompare(alt.brand_id)}
                  >
                    Compare
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
