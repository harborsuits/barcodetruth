import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, AlertTriangle, Flame, HelpCircle } from 'lucide-react';

interface CoverageStatusBadgeProps {
  status: string | null;
  lastCheckedAt?: string | null;
}

const statusConfig: Record<string, { icon: typeof CheckCircle2; label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  hot: { icon: Flame, label: 'Active coverage', variant: 'destructive' },
  active: { icon: CheckCircle2, label: 'Recently checked', variant: 'default' },
  quiet: { icon: Clock, label: 'No recent material events', variant: 'secondary' },
  stale: { icon: AlertTriangle, label: 'Coverage stale', variant: 'outline' },
  never_checked: { icon: HelpCircle, label: 'Not yet checked', variant: 'outline' },
};

export function CoverageStatusBadge({ status, lastCheckedAt }: CoverageStatusBadgeProps) {
  const config = statusConfig[status || 'never_checked'] || statusConfig.never_checked;
  const Icon = config.icon;

  const formatDate = (d: string | null | undefined) => {
    if (!d) return null;
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="flex items-center gap-2">
      <Badge variant={config.variant} className="gap-1 text-xs">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
      {lastCheckedAt && (
        <span className="text-xs text-muted-foreground">
          Last checked: {formatDate(lastCheckedAt)}
        </span>
      )}
    </div>
  );
}
