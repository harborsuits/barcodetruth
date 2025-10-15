import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";

type TrendingItem = { 
  brand_id: string; 
  name: string; 
  trend_score: number; 
  last_event_at: string | null; 
  score: number | null;
  events_7d: number | null;
  events_30d: number | null;
};

interface TrendingListProps {
  items: TrendingItem[];
  onOpen: (id: string) => void;
}

export function TrendingList({ items, onOpen }: TrendingListProps) {
  const getScoreColor = (score: number | null) => {
    if (!score) return "bg-muted text-muted-foreground";
    if (score >= 70) return "bg-success/10 text-success border-success/20";
    if (score >= 40) return "bg-warning/10 text-warning border-warning/20";
    return "bg-danger/10 text-danger border-danger/20";
  };

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No trending brands found
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <Card 
          key={item.brand_id}
          className="cursor-pointer hover:shadow-md transition-all"
          onClick={() => onOpen(item.brand_id)}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              {/* Rank Badge */}
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                {index + 1}
              </div>

              {/* Brand Info */}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{item.name}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span>{formatDate(item.last_event_at)}</span>
                  <span>•</span>
                  <span>{item.events_30d || 0} events (30d)</span>
                </div>
              </div>

              {/* Score Badge */}
              <div className={`flex flex-col items-center justify-center rounded-lg border px-3 py-1.5 shrink-0 ${getScoreColor(item.score)}`}>
                <div className="text-xl font-bold leading-none">
                  {item.score !== null ? Math.round(item.score) : "—"}
                </div>
                <div className="text-[10px] font-medium opacity-80 leading-none mt-0.5">
                  Score
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
