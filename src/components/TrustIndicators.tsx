import { Shield, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";

interface TrustIndicatorsProps {
  confidence: number;
  verifiedCount: number;
  totalCount: number;
  independentSources: number;
  lastUpdated?: string;
  proofRequired?: boolean;
}

export function TrustIndicators({ 
  confidence, 
  verifiedCount, 
  totalCount, 
  independentSources,
  lastUpdated,
  proofRequired 
}: TrustIndicatorsProps) {
  const daysSince = lastUpdated 
    ? Math.floor((Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  
  const isStale = daysSince && daysSince > 30;
  const verificationRate = totalCount > 0 ? Math.round((verifiedCount / totalCount) * 100) : 0;
  
  const getTrustLevel = () => {
    if (proofRequired) return { label: "Needs Verification", color: "text-warning", icon: AlertCircle };
    if (confidence >= 80 && verificationRate >= 70) return { label: "High Confidence", color: "text-success", icon: Shield };
    if (confidence >= 60 && verificationRate >= 50) return { label: "Moderate Confidence", color: "text-primary", icon: CheckCircle2 };
    return { label: "Low Confidence", color: "text-muted-foreground", icon: AlertCircle };
  };

  const trust = getTrustLevel();
  const TrustIcon = trust.icon;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-3 flex-wrap text-sm">
        {/* Trust Badge */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center gap-1.5 ${trust.color} font-medium`}>
              <TrustIcon className="h-4 w-4" />
              <span>{trust.label}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="space-y-1">
              <p className="font-semibold">Data Quality Score</p>
              <div className="space-y-0.5 text-xs">
                <div>Confidence: {confidence}/100</div>
                <div>Verification: {verificationRate}% ({verifiedCount}/{totalCount})</div>
                <div>Independent sources: {independentSources}</div>
                {proofRequired && (
                  <p className="text-warning">⚠ Awaiting independent confirmation</p>
                )}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Verification Progress */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              <Badge variant={verificationRate >= 70 ? "default" : verificationRate >= 50 ? "secondary" : "outline"}>
                {verifiedCount}/{totalCount} verified
              </Badge>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs max-w-xs">
              Verified sources include government records, official documents, and reputable news outlets
            </p>
          </TooltipContent>
        </Tooltip>

        {/* Independent Sources */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={independentSources >= 2 ? "default" : "outline"}>
              {independentSources} {independentSources === 1 ? "outlet" : "outlets"}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs max-w-xs">
              Number of independent media organizations reporting this information
            </p>
          </TooltipContent>
        </Tooltip>

        {/* Staleness Warning */}
        {isStale && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 text-warning">
                <Clock className="h-4 w-4" />
                <span className="text-xs">Updated {daysSince}d ago</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs max-w-xs">
                This score hasn't been updated in over 30 days. New information may be available.
              </p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Proof Required Alert */}
        {proofRequired && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                Proof Required
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs max-w-xs">
                Changes detected but awaiting verification from independent sources. Score impact is currently muted.
              </p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Confidence Bar */}
      <div className="w-full max-w-xs mt-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>Data Confidence</span>
          <span className="font-medium">{confidence}%</span>
        </div>
        <Progress 
          value={confidence} 
          className="h-1.5"
        />
      </div>
    </TooltipProvider>
  );
}
