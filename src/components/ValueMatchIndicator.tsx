import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, AlertCircle, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ValueMatchIndicatorProps {
  valueFit: number;
  topPriority: {
    name: string;
    weight: number;
    brandScore: number;
  };
  keyIssue?: string;
  alternativeName?: string;
  onViewAlternatives?: () => void;
  onViewFullDetails?: () => void;
}

export function ValueMatchIndicator({
  valueFit,
  topPriority,
  keyIssue,
  alternativeName,
  onViewAlternatives,
  onViewFullDetails
}: ValueMatchIndicatorProps) {
  const getMatchLevel = () => {
    if (valueFit >= 75) return {
      icon: CheckCircle,
      color: "text-success",
      bgColor: "bg-success/10",
      borderColor: "border-success/20",
      label: "Great match",
      message: "This brand aligns well with your values"
    };
    if (valueFit >= 50) return {
      icon: AlertCircle,
      color: "text-warning",
      bgColor: "bg-warning/10",
      borderColor: "border-warning/20",
      label: "Mixed match",
      message: "Some concerns in areas you care about"
    };
    return {
      icon: AlertTriangle,
      color: "text-danger",
      bgColor: "bg-danger/10",
      borderColor: "border-danger/20",
      label: "Not recommended",
      message: "Conflicts with your priorities"
    };
  };

  const match = getMatchLevel();
  const Icon = match.icon;

  return (
    <Card className={`border-2 ${match.borderColor} ${match.bgColor}`}>
      <CardContent className="pt-6 space-y-4">
        {/* Match Header */}
        <div className="flex items-start gap-3">
          <div className={`rounded-full p-2 ${match.bgColor}`}>
            <Icon className={`h-6 w-6 ${match.color}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className={`${match.color} font-semibold`}>
                {match.label}
              </Badge>
              <span className="text-2xl font-bold">{valueFit}% match</span>
            </div>
            <p className="text-sm text-muted-foreground">{match.message}</p>
          </div>
        </div>

        {/* Why Should I Care Section */}
        <div className="space-y-2 pt-2 border-t">
          <p className="text-sm font-medium">Why this matters to YOU:</p>
          <div className="bg-background/50 rounded-lg p-3 space-y-2">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <p className="text-sm">
                  You prioritize <strong className="text-foreground">{topPriority.name}</strong> ({Math.round(topPriority.weight * 100)}% of your values)
                </p>
                <p className="text-sm mt-1">
                  This brand's {topPriority.name.toLowerCase()} score: 
                  <span className={`font-bold ml-1 ${
                    topPriority.brandScore >= 70 ? 'text-success' : 
                    topPriority.brandScore >= 40 ? 'text-warning' : 
                    'text-danger'
                  }`}>
                    {topPriority.brandScore}/100
                  </span>
                </p>
              </div>
            </div>
            
            {keyIssue && (
              <p className="text-xs text-muted-foreground pt-2 border-t">
                Key concern: {keyIssue}
              </p>
            )}
          </div>
        </div>

        {/* Alternative Suggestion */}
        {alternativeName && valueFit < 75 && (
          <div className="flex items-center gap-2 pt-2 border-t">
            <TrendingUp className="h-4 w-4 text-success" />
            <span className="text-sm flex-1">
              <strong className="text-foreground">{alternativeName}</strong> might be a better fit
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          {onViewAlternatives && (
            <Button 
              onClick={onViewAlternatives} 
              variant="outline" 
              size="sm"
              className="flex-1"
            >
              Show Alternatives
            </Button>
          )}
          {onViewFullDetails && (
            <Button 
              onClick={onViewFullDetails}
              size="sm"
              className="flex-1"
            >
              View Full Details
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
