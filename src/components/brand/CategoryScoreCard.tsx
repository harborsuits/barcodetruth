import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Leaf, Vote, Users } from "lucide-react";

interface CategoryScoreCardProps {
  category: 'labor' | 'environment' | 'politics' | 'social';
  score: number;
  eventCount: number;
  onClick?: () => void;
  hasEnoughRatings?: boolean;
}

const categoryConfig = {
  labor: {
    label: 'Labor',
    icon: Briefcase,
    description: 'Worker rights & safety'
  },
  environment: {
    label: 'Environment',
    icon: Leaf,
    description: 'Climate & pollution'
  },
  politics: {
    label: 'Politics',
    icon: Vote,
    description: 'Lobbying & influence'
  },
  social: {
    label: 'Social',
    icon: Users,
    description: 'Product & conduct'
  }
};

export function CategoryScoreCard({ category, score, eventCount, onClick, hasEnoughRatings = true }: CategoryScoreCardProps) {
  const config = categoryConfig[category];
  const Icon = config.icon;
  
  // Score color logic
  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };
  
  return (
    <Card 
      className="p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-muted-foreground" />
          <div>
            <h3 className="font-semibold text-sm">{config.label}</h3>
            <p className="text-xs text-muted-foreground">{config.description}</p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs">
          {eventCount} events
        </Badge>
      </div>
      
      <div className="flex items-baseline gap-2">
        {hasEnoughRatings ? (
          <>
            <span className={`text-3xl font-bold ${getScoreColor(score)}`}>
              {score}
            </span>
            <span className="text-muted-foreground text-sm">/100</span>
          </>
        ) : (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Monitoring in progress
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Score will appear once enough verified events are collected
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
