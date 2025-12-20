import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  TrendingDown, 
  TrendingUp, 
  ExternalLink, 
  AlertTriangle,
  CheckCircle,
  Info,
  ChevronRight
} from "lucide-react";
import { useTopScoringEvents, type TopScoringEvent } from "@/hooks/useTopScoringEvents";
import { getCategoryLabel, getCategoryEmoji, type Category } from "@/lib/personalizedScoring";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";

interface WhyThisScoreSectionProps {
  brandId: string;
  brandName: string;
  isPersonalized?: boolean;
}

function getSeverityBadge(severity: string | null) {
  switch (severity?.toLowerCase()) {
    case 'severe':
      return <Badge variant="destructive" className="text-xs">Severe</Badge>;
    case 'moderate':
      return <Badge variant="secondary" className="text-xs bg-warning/20 text-warning-foreground border-warning/30">Moderate</Badge>;
    case 'minor':
      return <Badge variant="outline" className="text-xs">Minor</Badge>;
    default:
      return null;
  }
}

function getVerificationIcon(verificationLabel: string) {
  switch (verificationLabel) {
    case 'verified':
      return <CheckCircle className="h-3 w-3 text-success" />;
    case 'corroborated':
      return <CheckCircle className="h-3 w-3 text-muted-foreground" />;
    default:
      return <Info className="h-3 w-3 text-muted-foreground" />;
  }
}

function EventImpactRow({ event }: { event: TopScoringEvent }) {
  const isNegative = event.dominant_impact < 0;
  const category = event.dominant_category as Category;
  const absImpact = Math.abs(event.dominant_impact);
  
  // Format impact as percentage-like display
  const impactDisplay = (absImpact * 100).toFixed(0);
  
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className={`mt-0.5 ${isNegative ? 'text-danger' : 'text-success'}`}>
        {isNegative ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          <TrendingUp className="h-4 w-4" />
        )}
      </div>
      
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-medium leading-tight line-clamp-2">
          {event.title}
        </p>
        
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span>{getCategoryEmoji(category)}</span>
            <span>{getCategoryLabel(category)}</span>
          </span>
          
          <span className={`font-medium ${isNegative ? 'text-danger' : 'text-success'}`}>
            {isNegative ? '−' : '+'}{impactDisplay}%
          </span>
          
          {getSeverityBadge(event.severity)}
          
          <span className="flex items-center gap-1">
            {getVerificationIcon(event.verification_label)}
            <span className="capitalize">{event.verification_label}</span>
          </span>
          
          <span>
            {formatDistanceToNow(new Date(event.event_date), { addSuffix: true })}
          </span>
        </div>
      </div>
      
      {event.source_url && (
        <a 
          href={event.source_url}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground hover:text-primary transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}

export function WhyThisScoreSection({ brandId, brandName, isPersonalized }: WhyThisScoreSectionProps) {
  const { data: events, isLoading } = useTopScoringEvents(brandId, 3);
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Why This Score?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }
  
  const negativeEvents = events?.filter(e => e.dominant_impact < 0) || [];
  const positiveEvents = events?.filter(e => e.dominant_impact >= 0) || [];
  
  if (!events || events.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            Why This Score?
            {isPersonalized && (
              <Badge variant="secondary" className="text-xs">Personalized</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No significant events found in the last 90 days that affect {brandName}'s score.
          </p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            Why This Score?
            {isPersonalized && (
              <Badge variant="secondary" className="text-xs">Personalized</Badge>
            )}
          </CardTitle>
          <Link to={`/brand/${brandId}/proof`}>
            <Button variant="ghost" size="sm" className="text-xs">
              View all evidence
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {isPersonalized 
            ? "Based on your value preferences, these events most affect your score"
            : "Recent events that most impact this brand's score"
          }
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {negativeEvents.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-danger">
              <TrendingDown className="h-4 w-4" />
              Areas of Concern
            </div>
            <div className="space-y-2">
              {negativeEvents.map(event => (
                <EventImpactRow key={event.event_id} event={event} />
              ))}
            </div>
          </div>
        )}
        
        {positiveEvents.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-success">
              <TrendingUp className="h-4 w-4" />
              Positive Factors
            </div>
            <div className="space-y-2">
              {positiveEvents.map(event => (
                <EventImpactRow key={event.event_id} event={event} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
