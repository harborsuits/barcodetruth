import { Badge } from "@/components/ui/badge";
import { 
  AlertTriangle, 
  Scale, 
  Users, 
  Leaf, 
  BadgeCheck,
  TrendingDown,
  Building2
} from "lucide-react";
import { useTopScoringEvents, type TopScoringEvent } from "@/hooks/useTopScoringEvents";
import { Skeleton } from "@/components/ui/skeleton";

interface TrustSignalsProps {
  brandId: string;
}

interface TrustSignal {
  icon: React.ReactNode;
  label: string;
  type: 'warning' | 'positive' | 'neutral';
  category: string;
}

function deriveSignals(events: TopScoringEvent[]): TrustSignal[] {
  const signals: TrustSignal[] = [];
  const seenCategories = new Set<string>();
  
  for (const event of events) {
    // Only show one signal per category
    if (seenCategories.has(event.dominant_category)) continue;
    seenCategories.add(event.dominant_category);
    
    const isNegative = event.dominant_impact < 0;
    const isSevere = event.severity === 'severe';
    const isModerate = event.severity === 'moderate';
    const code = event.category_code?.toUpperCase() || '';
    
    // Derive specific signals based on category code and severity
    if (code.includes('LABOR') || code.includes('WORK') || event.dominant_category === 'labor') {
      if (isNegative && (isSevere || isModerate)) {
        signals.push({
          icon: <Users className="h-3.5 w-3.5" />,
          label: isSevere ? 'Labor dispute' : 'Worker concerns',
          type: 'warning',
          category: 'labor'
        });
      }
    }
    
    if (code.includes('ENV') || code.includes('CLIMATE') || event.dominant_category === 'environment') {
      if (isNegative && (isSevere || isModerate)) {
        signals.push({
          icon: <Leaf className="h-3.5 w-3.5" />,
          label: isSevere ? 'Environmental violation' : 'Sustainability concern',
          type: 'warning',
          category: 'environment'
        });
      } else if (!isNegative) {
        signals.push({
          icon: <Leaf className="h-3.5 w-3.5" />,
          label: 'Sustainability initiative',
          type: 'positive',
          category: 'environment'
        });
      }
    }
    
    if (code.includes('LEGAL') || code.includes('LAW') || code.includes('SUIT')) {
      if (isNegative) {
        signals.push({
          icon: <Scale className="h-3.5 w-3.5" />,
          label: isSevere ? 'Active lawsuit' : 'Legal matter',
          type: 'warning',
          category: 'legal'
        });
      }
    }
    
    if (code.includes('POLITIC') || code.includes('LOBBY') || event.dominant_category === 'politics') {
      if (isNegative && (isSevere || isModerate)) {
        signals.push({
          icon: <Building2 className="h-3.5 w-3.5" />,
          label: 'Political activity',
          type: 'warning',
          category: 'politics'
        });
      }
    }
    
    if (code.includes('RECALL') || code.includes('SAFETY')) {
      signals.push({
        icon: <AlertTriangle className="h-3.5 w-3.5" />,
        label: 'Product recall',
        type: 'warning',
        category: 'safety'
      });
    }
  }
  
  // Add general negative signal if we have severe negative events but no specific signals
  const hasSevereNegative = events.some(e => e.dominant_impact < 0 && e.severity === 'severe');
  if (hasSevereNegative && signals.length === 0) {
    signals.push({
      icon: <TrendingDown className="h-3.5 w-3.5" />,
      label: 'Recent concerns',
      type: 'warning',
      category: 'general'
    });
  }
  
  // Limit to 3 signals max
  return signals.slice(0, 3);
}

export function TrustSignals({ brandId }: TrustSignalsProps) {
  const { data: events, isLoading } = useTopScoringEvents(brandId, 10);
  
  if (isLoading) {
    return (
      <div className="flex gap-2">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-20" />
      </div>
    );
  }
  
  if (!events || events.length === 0) {
    return null;
  }
  
  const signals = deriveSignals(events);
  
  if (signals.length === 0) {
    // No significant signals - optionally show a positive indicator
    const hasOnlyPositive = events.every(e => e.dominant_impact >= 0);
    if (hasOnlyPositive && events.length > 0) {
      return (
        <div className="flex flex-wrap gap-2">
          <Badge 
            variant="outline" 
            className="text-xs gap-1 bg-success/10 text-success border-success/30"
          >
            <BadgeCheck className="h-3.5 w-3.5" />
            No recent concerns
          </Badge>
        </div>
      );
    }
    return null;
  }
  
  return (
    <div className="flex flex-wrap gap-2">
      {signals.map((signal, i) => (
        <Badge 
          key={`${signal.category}-${i}`}
          variant="outline"
          className={`text-xs gap-1 ${
            signal.type === 'warning' 
              ? 'bg-warning/10 text-warning-foreground border-warning/30'
              : signal.type === 'positive'
                ? 'bg-success/10 text-success border-success/30'
                : 'bg-muted'
          }`}
        >
          {signal.icon}
          {signal.label}
        </Badge>
      ))}
    </div>
  );
}
