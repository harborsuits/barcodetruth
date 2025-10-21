import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp } from "lucide-react";

interface ValuationChipProps {
  valuation?: {
    metric: string;
    value: number;
    currency: string;
    as_of_date: string;
    source: string;
  };
}

function formatValue(value: number, currency: string): string {
  const billions = value / 1_000_000_000;
  const millions = value / 1_000_000;

  if (billions >= 1) {
    return `${currency} ${billions.toFixed(1)}B`;
  } else if (millions >= 1) {
    return `${currency} ${millions.toFixed(0)}M`;
  }
  return `${currency} ${value.toLocaleString()}`;
}

export function ValuationChip({ valuation }: ValuationChipProps) {
  if (!valuation) {
    return null;
  }

  const displayValue = formatValue(valuation.value, valuation.currency);
  const metricLabel = valuation.metric === 'market_cap' ? 'Market Cap' : 'Valuation';
  const asOfDate = new Date(valuation.as_of_date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="gap-1.5 cursor-help">
            <TrendingUp className="h-3 w-3" />
            <span className="font-semibold">{displayValue}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">{metricLabel}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs space-y-1">
            <p className="font-medium">{metricLabel}: {displayValue}</p>
            <p className="text-muted-foreground">As of: {asOfDate}</p>
            <p className="text-muted-foreground">Source: {valuation.source}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
