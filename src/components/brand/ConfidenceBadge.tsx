import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sparkles, TrendingUp, ShieldCheck, Database } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ConfidenceBadgeProps {
  brandId?: string;
  confidence?: 'early' | 'growing' | 'strong';
  className?: string;
}

const confidenceConfig = {
  early: {
    label: 'Limited data',
    icon: Sparkles,
    variant: 'outline' as const,
    className: 'border-amber-500/50 text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400',
    tooltip: 'Score based on very few events',
  },
  growing: {
    label: 'Some data',
    icon: TrendingUp,
    variant: 'outline' as const,
    className: 'border-blue-500/50 text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400',
    tooltip: 'Reasonable signal — check the events',
  },
  strong: {
    label: 'Strong data',
    icon: ShieldCheck,
    variant: 'outline' as const,
    className: 'border-emerald-500/50 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400',
    tooltip: 'High confidence, well-documented brand',
  },
  good: {
    label: 'Good data',
    icon: Database,
    variant: 'outline' as const,
    className: 'border-primary/50 text-primary bg-primary/5',
    tooltip: 'Solid basis for this score',
  },
};

function getConfidenceFromCount(count: number): keyof typeof confidenceConfig {
  if (count >= 25) return 'strong';
  if (count >= 10) return 'good';
  if (count >= 3) return 'growing';
  return 'early';
}

export function ConfidenceBadge({ brandId, confidence, className }: ConfidenceBadgeProps) {
  const { data: eventCount } = useQuery({
    queryKey: ["brand-scored-event-count", brandId],
    queryFn: async () => {
      const { count } = await supabase
        .from("brand_events")
        .select("*", { count: "exact", head: true })
        .eq("brand_id", brandId!)
        .eq("score_eligible", true)
        .eq("is_irrelevant", false);
      return count || 0;
    },
    enabled: !!brandId && !confidence,
  });

  const resolvedConfidence = confidence || (eventCount != null ? getConfidenceFromCount(eventCount) : null);
  if (!resolvedConfidence) return null;

  const config = confidenceConfig[resolvedConfidence];
  const Icon = config.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant={config.variant} 
          className={`${config.className} gap-1 text-[10px] ${className || ''}`}
        >
          <Icon className="h-3 w-3" />
          {config.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs max-w-48">
        <p>{config.tooltip}</p>
        {eventCount != null && <p className="text-muted-foreground mt-1">{eventCount} scored event{eventCount !== 1 ? 's' : ''}</p>}
      </TooltipContent>
    </Tooltip>
  );
}
