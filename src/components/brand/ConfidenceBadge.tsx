import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, ShieldCheck } from "lucide-react";

interface ConfidenceBadgeProps {
  confidence: 'early' | 'growing' | 'strong';
  className?: string;
}

const confidenceConfig = {
  early: {
    label: 'Early Data',
    icon: Sparkles,
    variant: 'outline' as const,
    className: 'border-amber-500/50 text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400',
  },
  growing: {
    label: 'Growing',
    icon: TrendingUp,
    variant: 'outline' as const,
    className: 'border-blue-500/50 text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400',
  },
  strong: {
    label: 'Strong',
    icon: ShieldCheck,
    variant: 'outline' as const,
    className: 'border-emerald-500/50 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400',
  },
};

export function ConfidenceBadge({ confidence, className }: ConfidenceBadgeProps) {
  const config = confidenceConfig[confidence];
  const Icon = config.icon;

  return (
    <Badge 
      variant={config.variant} 
      className={`${config.className} gap-1 ${className || ''}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
