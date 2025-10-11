import { Shield, AlertTriangle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DataQualityIndicatorProps {
  eventCount: number;
  verifiedCount: number;
  independentSources: number;
  className?: string;
}

export function DataQualityIndicator({ 
  eventCount, 
  verifiedCount, 
  independentSources,
  className 
}: DataQualityIndicatorProps) {
  const getQuality = () => {
    if (eventCount === 0) {
      return {
        level: "none",
        label: "No Data",
        description: "Baseline estimates only",
        icon: AlertTriangle,
        color: "text-destructive bg-destructive/10 border-destructive/30"
      };
    }
    
    if (eventCount < 3) {
      return {
        level: "low",
        label: "Limited Data",
        description: `${eventCount} event${eventCount > 1 ? 's' : ''}, ${verifiedCount} verified`,
        icon: Info,
        color: "text-warning bg-warning/10 border-warning/30"
      };
    }
    
    const verificationRate = verifiedCount / eventCount;
    
    if (verificationRate >= 0.7 && independentSources >= 2) {
      return {
        level: "high",
        label: "Strong Data",
        description: `${eventCount} events, ${verifiedCount} verified, ${independentSources} sources`,
        icon: Shield,
        color: "text-success bg-success/10 border-success/30"
      };
    }
    
    return {
      level: "medium",
      label: "Moderate Data",
      description: `${eventCount} events, ${verifiedCount} verified`,
      icon: Info,
      color: "text-primary bg-primary/10 border-primary/30"
    };
  };

  const quality = getQuality();
  const Icon = quality.icon;

  return (
    <div className={cn("inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium", quality.color, className)}>
      <Icon className="h-3.5 w-3.5" />
      <div className="flex flex-col items-start">
        <span className="font-semibold">{quality.label}</span>
        <span className="text-[10px] opacity-80">{quality.description}</span>
      </div>
    </div>
  );
}
