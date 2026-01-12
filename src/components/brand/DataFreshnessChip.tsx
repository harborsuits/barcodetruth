import { Clock, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface DataFreshnessChipProps {
  lastUpdated?: string | null;
  className?: string;
}

export function DataFreshnessChip({ lastUpdated, className }: DataFreshnessChipProps) {
  if (!lastUpdated) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={cn("gap-1 text-muted-foreground", className)}>
            <RefreshCw className="h-3 w-3" />
            <span className="text-xs">Updating</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>Data collection in progress</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  const date = new Date(lastUpdated);
  const daysSince = differenceInDays(new Date(), date);
  const timeAgo = formatDistanceToNow(date, { addSuffix: true });

  // Determine freshness level
  let Icon = CheckCircle;
  let colorClass = 'text-green-600 dark:text-green-400 border-green-500/30 bg-green-500/10';
  let label = 'Fresh';
  let tooltip = `Data updated ${timeAgo}`;

  if (daysSince > 60) {
    Icon = AlertTriangle;
    colorClass = 'text-red-600 dark:text-red-400 border-red-500/30 bg-red-500/10';
    label = 'Stale';
    tooltip = `Data is ${daysSince} days old — may be outdated`;
  } else if (daysSince > 30) {
    Icon = Clock;
    colorClass = 'text-orange-600 dark:text-orange-400 border-orange-500/30 bg-orange-500/10';
    label = `${daysSince}d ago`;
    tooltip = `Data updated ${timeAgo} — consider checking for recent news`;
  } else if (daysSince > 7) {
    Icon = Clock;
    colorClass = 'text-yellow-600 dark:text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
    label = `${daysSince}d ago`;
    tooltip = `Data updated ${timeAgo}`;
  } else {
    label = timeAgo.replace(' ago', '').replace('about ', '');
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={cn("gap-1", colorClass, className)}>
          <Icon className="h-3 w-3" />
          <span className="text-xs">{label}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}
