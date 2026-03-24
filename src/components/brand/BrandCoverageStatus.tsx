import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, AlertTriangle, Flame, HelpCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface BrandCoverageStatusProps {
  status: string | null | undefined;
  lastCheckedAt?: string | null;
  materialEventCount?: number | null;
}

const statusConfig: Record<string, { 
  icon: typeof CheckCircle2; 
  label: string; 
  description: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
}> = {
  hot: { 
    icon: Flame, 
    label: 'Active coverage', 
    description: 'Multiple recent material events found.',
    variant: 'destructive' 
  },
  active: { 
    icon: CheckCircle2, 
    label: 'Recently checked', 
    description: 'No recent material events found.',
    variant: 'default' 
  },
  quiet: { 
    icon: Clock, 
    label: 'No recent material events', 
    description: 'We checked — nothing material found recently.',
    variant: 'secondary' 
  },
  stale: { 
    icon: AlertTriangle, 
    label: 'Coverage is stale', 
    description: 'We haven\'t refreshed this brand recently.',
    variant: 'outline' 
  },
  never_checked: { 
    icon: HelpCircle, 
    label: 'Not yet checked', 
    description: 'News coverage has not been verified yet.',
    variant: 'outline' 
  },
};

export function BrandCoverageStatus({ status, lastCheckedAt, materialEventCount }: BrandCoverageStatusProps) {
  const key = status || 'never_checked';
  const config = statusConfig[key] || statusConfig.never_checked;
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border">
      <div className="mt-0.5">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={config.variant} className="text-xs">
            {config.label}
          </Badge>
          {materialEventCount != null && materialEventCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {materialEventCount} material event{materialEventCount !== 1 ? 's' : ''} in 30d
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{config.description}</p>
        {lastCheckedAt && (
          <p className="text-xs text-muted-foreground/70">
            Last checked {formatDistanceToNow(new Date(lastCheckedAt), { addSuffix: true })}
          </p>
        )}
      </div>
    </div>
  );
}
