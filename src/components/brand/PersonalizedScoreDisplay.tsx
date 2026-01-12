import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, TrendingUp, TrendingDown, HelpCircle, ChevronDown, ChevronUp } from "lucide-react";
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
  
  const isLoading = userId ? personalizedLoading : defaultLoading;
  const result = userId ? personalizedResult : defaultResult;
  const isPersonalized = !!userId && !!personalizedResult;

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

  if (!result) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Alignment Score</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Unable to calculate score. Not enough data available.
          </p>
        </CardContent>
      </Card>
    );
  }

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
                  <Badge variant="outline" className="text-xs">General</Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Set your values in Settings for a personalized score</p>
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
              {result.personalScore >= 70 && "Good alignment with your values"}
              {result.personalScore >= 40 && result.personalScore < 70 && "Mixed alignment with your values"}
              {result.personalScore < 40 && "Poor alignment with your values"}
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
