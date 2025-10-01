import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { EventCard } from "./EventCard";
import { Badge } from "./ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";

interface EventImpact {
  category: string;
  categoryLabel: string;
  impact: number;
  eventCount: number;
  events: any[];
}

interface WhyThisScoreProps {
  brandId: string;
  impacts: EventImpact[];
}

const categoryConfig = {
  labor: { label: "Labor", color: "text-blue-600" },
  environment: { label: "Environment", color: "text-green-600" },
  politics: { label: "Politics", color: "text-purple-600" },
  social: { label: "Social", color: "text-orange-600" },
};

export function WhyThisScore({ brandId, impacts }: WhyThisScoreProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  if (!impacts || impacts.length === 0) return null;

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Score Drivers</h3>
        <Badge variant="outline" className="text-xs">
          EPA & public records
        </Badge>
      </div>
      
      <div className="space-y-2">
        {impacts.map((impact) => {
          const config = categoryConfig[impact.category as keyof typeof categoryConfig];
          const isExpanded = expandedCategories.has(impact.category);
          
          return (
            <Collapsible
              key={impact.category}
              open={isExpanded}
              onOpenChange={() => toggleCategory(impact.category)}
            >
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${config.color}`}>
                      {config.label}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {impact.impact > 0 ? '+' : ''}{impact.impact}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {impact.eventCount} {impact.eventCount === 1 ? 'event' : 'events'}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="mt-2 space-y-2">
                {impact.events.map((event) => (
                  <EventCard
                    key={event.event_id}
                    event={event}
                    compact
                  />
                ))}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
      
      <p className="text-xs text-muted-foreground">
        Based on verified events from the last 12 months
      </p>
    </div>
  );
}
