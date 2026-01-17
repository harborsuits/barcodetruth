import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, TrendingUp, TrendingDown, HelpCircle, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePersonalizedBrandScore, useDefaultBrandScore } from "@/hooks/usePersonalizedBrandScore";
import {
  type ScoringResult,
  type CategoryContribution,
  getCategoryLabel,
  getCategoryEmoji,
} from "@/lib/personalizedScoring";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";

interface PersonalizedScoreDisplayProps {
  brandId: string;
  brandName: string;
  identityConfidence?: string;
}

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (score / 100) * circumference;
  
  const getScoreColor = (s: number) => {
    if (s >= 70) return 'text-success stroke-success';
    if (s >= 40) return 'text-warning stroke-warning';
    return 'text-danger stroke-danger';
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={36}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted/20"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={36}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`transition-all duration-500 ${getScoreColor(score)}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-2xl font-bold ${getScoreColor(score)}`}>
          {score}
        </span>
      </div>
    </div>
  );
}

function ContributionBar({ contribution }: { contribution: CategoryContribution }) {
  const absValue = Math.abs(contribution.contribution);
  const maxValue = 1; // Normalized max
  const percentage = Math.min((absValue / maxValue) * 100, 100);
  
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5">
          <span>{getCategoryEmoji(contribution.category)}</span>
          <span>{getCategoryLabel(contribution.category)}</span>
        </span>
        <span className={contribution.isPositive ? 'text-success' : 'text-danger'}>
          {contribution.isPositive ? '+' : '-'}{absValue.toFixed(2)}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            contribution.isPositive ? 'bg-success' : 'bg-danger'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function WhyFlaggedSection({ result }: { result: ScoringResult }) {
  const [isOpen, setIsOpen] = useState(false);
  
  const hasNegative = result.topNegative.length > 0;
  const hasPositive = result.topPositive.length > 0;

  if (!hasNegative && !hasPositive) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No significant factors identified for your preferences.
      </p>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between">
          <span className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            Why this score?
          </span>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 pt-4">
        {hasNegative && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-danger">
              <TrendingDown className="h-4 w-4" />
              Areas of Concern
            </div>
            <div className="space-y-3 pl-6">
              {result.topNegative.map(c => (
                <ContributionBar key={c.category} contribution={c} />
              ))}
            </div>
          </div>
        )}
        
        {hasPositive && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-success">
              <TrendingUp className="h-4 w-4" />
              Positive Factors
            </div>
            <div className="space-y-3 pl-6">
              {result.topPositive.map(c => (
                <ContributionBar key={c.category} contribution={c} />
              ))}
            </div>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function DealBreakerBanner({ result }: { result: ScoringResult }) {
  if (!result.dealbreaker.triggered || !result.dealbreaker.category) return null;
  
  return (
    <div className="flex items-center gap-2 p-3 bg-danger/10 border border-danger/20 rounded-lg">
      <AlertTriangle className="h-5 w-5 text-danger flex-shrink-0" />
      <div className="text-sm">
        <span className="font-medium text-danger">Dealbreaker triggered: </span>
        <span>{getCategoryLabel(result.dealbreaker.category)}</span>
        <p className="text-muted-foreground text-xs mt-0.5">
          This brand falls below your threshold for this category
        </p>
      </div>
    </div>
  );
}

export function PersonalizedScoreDisplay({ brandId, brandName, identityConfidence }: PersonalizedScoreDisplayProps) {
  // Get current user
  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });
  
  const userId = session?.user?.id;
  
  // Fetch personalized score if logged in, otherwise default
  const { data: personalizedResult, isLoading: personalizedLoading } = usePersonalizedBrandScore(brandId, userId);
  const { data: defaultResult, isLoading: defaultLoading } = useDefaultBrandScore(brandId);
  
  // FALLBACK: Fetch brand_scores.score directly as backup
  const { data: fallbackScore, isLoading: fallbackLoading } = useQuery({
    queryKey: ['brand-scores-fallback', brandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brand_scores')
        .select('score, last_updated')
        .eq('brand_id', brandId)
        .maybeSingle();
      if (error || !data) return null;
      return data;
    },
    enabled: !!brandId,
  });
  
  const isLoading = (userId ? personalizedLoading : defaultLoading) && fallbackLoading;
  const vectorResult = userId ? personalizedResult : defaultResult;
  const isPersonalized = !!userId && !!personalizedResult;
  
  // Check if vector-based score is valid (not all zeros)
  const vectorScoreIsValid = vectorResult && vectorResult.personalScore !== 50; // 50 is the default when all zeros
  
  // Use vector result if valid, otherwise fall back to brand_scores.score
  const hasValidScore = vectorScoreIsValid || (fallbackScore?.score !== null && fallbackScore?.score !== undefined);
  const displayScore = vectorScoreIsValid ? vectorResult?.personalScore : fallbackScore?.score;
  const isFallbackScore = !vectorScoreIsValid && fallbackScore?.score !== null;

  // Identity confidence gate
  if (identityConfidence === 'low') {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <span>Alignment Score</span>
            <Badge variant="outline" className="text-xs">Pending</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <p className="text-sm text-muted-foreground">
              Score pending identity verification. We're still confirming this is the correct {brandName}.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Alignment Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show fallback score if vector-based scoring failed but brand_scores exists
  if (!vectorScoreIsValid && isFallbackScore && displayScore !== null && displayScore !== undefined) {
    const score = Math.round(displayScore);
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <span>Alignment Score</span>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="outline" className="text-xs">Baseline</Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Aggregate score based on recent evidence. Sign in and set your values for a personalized score.</p>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-6">
            <ScoreRing score={score} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground mb-2">
                {score >= 70 && "Low risk — positive track record"}
                {score >= 40 && score < 70 && "Mixed record — some concerns noted"}
                {score < 40 && "High exposure — significant concerns"}
              </p>
              {fallbackScore?.last_updated && (
                <p className="text-xs text-muted-foreground">
                  Last updated: {new Date(fallbackScore.last_updated).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
          
          {!userId && (
            <p className="text-xs text-muted-foreground text-center pt-2 border-t">
              <a href="/auth" className="text-primary hover:underline">
                Sign in
              </a>
              {' '}to see a score personalized to your values
            </p>
          )}
          {userId && (
            <p className="text-xs text-muted-foreground text-center pt-2 border-t">
              <a href="/settings" className="text-primary hover:underline">
                Set your values
              </a>
              {' '}to see a personalized score
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // No score available at all
  if (!hasValidScore) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <span>Alignment Score</span>
            <Badge variant="outline" className="text-xs">Computing</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
            <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
            <p className="text-sm text-muted-foreground">
              Score computing. We're gathering and analyzing evidence for {brandName}.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Use the full vector-based result for personalized display
  const result = vectorResult!;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <span>Alignment Score</span>
            {isPersonalized ? (
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="secondary" className="text-xs">Personalized</Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Based on your value preferences</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="outline" className="text-xs">Baseline</Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>This is a baseline score using equal weight across all concerns. Sign in to see how it matches your specific values.</p>
                </TooltipContent>
              </Tooltip>
            )}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <DealBreakerBanner result={result} />
        
        <div className="flex items-start gap-6">
          <ScoreRing score={result.personalScore} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground mb-2">
              {result.personalScore >= 70 && "Strong alignment with your values"}
              {result.personalScore >= 40 && result.personalScore < 70 && "Partial alignment — some tradeoffs"}
              {result.personalScore < 40 && "Low alignment — review concerns below"}
            </p>
            
            {/* Category breakdown mini bars */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {result.contributions.map(c => (
                <div key={c.category} className="flex items-center gap-1">
                  <span>{getCategoryEmoji(c.category)}</span>
                  <Progress 
                    value={50 + (c.score * 25)} 
                    className="h-1.5 flex-1"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <WhyFlaggedSection result={result} />
        
        {!isPersonalized && !userId && (
          <p className="text-xs text-muted-foreground text-center pt-2 border-t">
            <a href="/auth" className="text-primary hover:underline">
              Sign in
            </a>
            {' '}to see a score personalized to your values
          </p>
        )}
        {!isPersonalized && userId && (
          <p className="text-xs text-muted-foreground text-center pt-2 border-t">
            <a href="/settings" className="text-primary hover:underline">
              Set your values
            </a>
            {' '}to see a personalized score
          </p>
        )}
      </CardContent>
    </Card>
  );
}
