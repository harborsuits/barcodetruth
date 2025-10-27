import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ShieldCheck, AlertCircle, Info } from "lucide-react";

type VerificationLevel = 'verified' | 'corroborated' | 'unverified' | 'disputed' | null;

interface VerificationBadgeProps {
  verification: VerificationLevel;
  sourceName?: string | null;
  size?: 'sm' | 'md';
}

const VERIFICATION_CONFIG = {
  verified: {
    label: 'Official',
    tooltip: 'Verified from official sources (government filings, court docs)',
    icon: ShieldCheck,
    variant: 'default' as const,
    color: 'text-green-600 dark:text-green-400'
  },
  corroborated: {
    label: 'Verified',
    tooltip: 'Confirmed by multiple reputable sources',
    icon: ShieldCheck,
    variant: 'secondary' as const,
    color: 'text-blue-600 dark:text-blue-400'
  },
  unverified: {
    label: 'Reported',
    tooltip: 'Single reputable source, not yet corroborated',
    icon: Info,
    variant: 'outline' as const,
    color: 'text-muted-foreground'
  },
  disputed: {
    label: 'Disputed',
    tooltip: 'Conflicting reports or contested information',
    icon: AlertCircle,
    variant: 'destructive' as const,
    color: 'text-red-600 dark:text-red-400'
  }
} as const;

export function VerificationBadge({ 
  verification, 
  sourceName,
  size = 'md' 
}: VerificationBadgeProps) {
  const config = verification ? VERIFICATION_CONFIG[verification] : VERIFICATION_CONFIG.unverified;
  const Icon = config.icon;
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';
  const textSize = size === 'sm' ? 'text-xs' : 'text-xs';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={config.variant} className={`gap-1 ${textSize}`}>
            <Icon className={`${iconSize} ${config.color}`} />
            {config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm font-medium mb-1">{config.tooltip}</p>
          {sourceName && (
            <p className="text-xs text-muted-foreground">Source: {sourceName}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
