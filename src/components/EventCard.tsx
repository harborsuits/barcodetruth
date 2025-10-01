import { User, Sprout, Building2, Users, ExternalLink, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type CategoryType = "labor" | "environment" | "politics" | "cultural-values";

interface EventSource {
  name: string;
  url?: string;
  date: string;
  quote?: string;
}

export interface BrandEvent {
  category: CategoryType;
  description: string;
  source: EventSource;
  impact?: {
    labor?: number;
    environment?: number;
    politics?: number;
    social?: number;
  };
  verified?: boolean;
  severity?: "minor" | "moderate" | "severe";
}

const categoryConfig: Record<CategoryType, { icon: any; label: string; color: string }> = {
  labor: { icon: User, label: "Labor", color: "text-labor" },
  environment: { icon: Sprout, label: "Environment", color: "text-environment" },
  politics: { icon: Building2, label: "Politics", color: "text-politics" },
  "cultural-values": { icon: Users, label: "Cultural/Values", color: "text-[hsl(var(--cultural-values))]" },
};

const getSeverityColor = (severity?: string) => {
  if (severity === "severe") return "border-l-danger";
  if (severity === "moderate") return "border-l-warning";
  return "border-l-muted";
};

interface EventCardProps {
  event: BrandEvent;
  showFullDetails?: boolean;
}

export const EventCard = ({ event, showFullDetails = false }: EventCardProps) => {
  const config = categoryConfig[event.category];
  const CategoryIcon = config.icon;
  const isPositive = event.impact && Object.values(event.impact).some(v => v > 0);

  return (
    <Card className={`border-l-4 ${isPositive ? "border-l-success" : getSeverityColor(event.severity)}`}>
      <CardContent className="p-4 space-y-3">
        {/* Category Badge */}
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`flex items-center gap-1 ${config.color}`}>
            <CategoryIcon className="h-3 w-3" />
            {config.label}
          </Badge>
          {event.verified && (
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
          )}
          {event.severity && (
            <Badge variant="secondary" className="text-xs capitalize">
              {event.severity}
            </Badge>
          )}
        </div>

        {/* Event Description */}
        <p className="text-sm leading-relaxed text-foreground">
          {event.description}
        </p>

        {/* Impact */}
        {event.impact && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Impact:</span>{" "}
            {Object.entries(event.impact)
              .map(([key, value]) => `${(value as number) > 0 ? "+" : ""}${value} ${key.charAt(0).toUpperCase() + key.slice(1)}`)
              .join(" | ")}
          </p>
        )}

        {/* Source Citation */}
        {showFullDetails && event.source.quote ? (
          <div className="space-y-2 pt-2 border-t">
            <blockquote className="pl-3 border-l-2 border-muted text-xs text-muted-foreground italic leading-relaxed">
              "{event.source.quote}"
            </blockquote>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground/70 italic">
                {event.source.name}, {event.source.date}
              </p>
              {event.source.url && (
                <a
                  href={event.source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  View source
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground/70 italic">
            According to {event.source.name}, {event.source.date}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
