import { Info, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface InlineDisclaimerProps {
  variant?: 'compact' | 'expandable';
  className?: string;
}

export function InlineDisclaimer({ variant = 'compact', className }: InlineDisclaimerProps) {
  const [expanded, setExpanded] = useState(false);

  if (variant === 'compact') {
    return (
      <div className={cn(
        "flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border/50 text-sm",
        className
      )}>
        <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
        <p className="text-muted-foreground leading-relaxed">
          Information shown is aggregated from public sources. We don't tell you what to think — we show what's verifiable.{' '}
          <a href="/methodology" className="text-primary hover:underline inline-flex items-center gap-1">
            See our methodology
            <ExternalLink className="h-3 w-3" />
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-lg bg-muted/50 border border-border/50 text-sm overflow-hidden",
      className
    )}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 p-3 w-full text-left hover:bg-muted/70 transition-colors"
      >
        <Info className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="text-muted-foreground">About this information</span>
        <span className="ml-auto text-xs text-muted-foreground/70">
          {expanded ? '▲' : '▼'}
        </span>
      </button>
      
      {expanded && (
        <div className="px-3 pb-3 space-y-2 text-muted-foreground border-t border-border/50 pt-3">
          <p>
            BarcodeTruth aggregates information from publicly available sources including news outlets, 
            government databases, and official company filings.
          </p>
          <p>
            <strong className="text-foreground">We don't tell you what to think</strong> — we show what's 
            verifiable and let you draw your own conclusions.
          </p>
          <p>
            This is informational research, not authoritative truth. Data may be incomplete or not yet indexed.
          </p>
          <div className="flex gap-4 pt-2">
            <a href="/methodology" className="text-primary hover:underline inline-flex items-center gap-1">
              Methodology
              <ExternalLink className="h-3 w-3" />
            </a>
            <a href="/responsible-use" className="text-primary hover:underline inline-flex items-center gap-1">
              Responsible Use
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
