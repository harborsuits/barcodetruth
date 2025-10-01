import { useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp, TrendingDown, Heart, Ban, Bell, User, Sprout, Building2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

type CategoryType = "labor" | "environment" | "politics" | "cultural-values";

interface Event {
  category: CategoryType;
  description: string;
  source: {
    name: string;
    date: string;
  };
  impact?: {
    labor?: number;
    environment?: number;
    politics?: number;
    social?: number;
  };
}

const categoryConfig: Record<CategoryType, { icon: any; label: string; color: string }> = {
  labor: { icon: User, label: "Labor", color: "text-labor" },
  environment: { icon: Sprout, label: "Environment", color: "text-environment" },
  politics: { icon: Building2, label: "Politics", color: "text-politics" },
  "cultural-values": { icon: Users, label: "Cultural/Values", color: "text-[hsl(var(--cultural-values))]" },
};

const trendingBrands = [
  {
    id: "nike",
    name: "Nike",
    score: 72,
    velocity: "falling" as const,
    change: -8,
    events: [
      {
        category: "labor" as const,
        description: "Workers at manufacturing facilities reported wage and safety concerns.",
        source: { name: "Reuters", date: "Sept 2025" },
        impact: { labor: -15, social: -5 },
      },
      {
        category: "labor" as const,
        description: "Supplier audit disputes over working conditions.",
        source: { name: "Bloomberg", date: "July 2025" },
        impact: { labor: -8 },
      },
    ],
  },
  {
    id: "patagonia",
    name: "Patagonia",
    score: 91,
    velocity: "rising" as const,
    change: 12,
    events: [
      {
        category: "environment" as const,
        description: "Launched comprehensive supply chain transparency initiative with third-party verification.",
        source: { name: "The Guardian", date: "Aug 2025" },
        impact: { environment: 15, social: 8 },
      },
      {
        category: "labor" as const,
        description: "Unionization disputes at distribution centers.",
        source: { name: "AP News", date: "May 2025" },
        impact: { labor: -5 },
      },
    ],
  },
  {
    id: "amazon",
    name: "Amazon",
    score: 45,
    velocity: "falling" as const,
    change: -15,
    events: [
      {
        category: "labor" as const,
        description: "Multiple reports surfaced regarding warehouse working conditions.",
        source: { name: "New York Times", date: "Sept 2025" },
        impact: { labor: -12, social: -8 },
      },
      {
        category: "politics" as const,
        description: "Increased political spending disclosures raised concerns.",
        source: { name: "Washington Post", date: "Aug 2025" },
        impact: { politics: -10 },
      },
      {
        category: "environment" as const,
        description: "Carbon emissions reduction targets announced.",
        source: { name: "Bloomberg", date: "June 2025" },
        impact: { environment: 8 },
      },
    ],
  },
  {
    id: "allbirds",
    name: "Allbirds",
    score: 89,
    velocity: "rising" as const,
    change: 7,
    events: [
      {
        category: "environment" as const,
        description: "Released detailed carbon footprint data for all products and expanded sustainable materials program.",
        source: { name: "Bloomberg", date: "Aug 2025" },
        impact: { environment: 12, social: 5 },
      },
      {
        category: "cultural-values" as const,
        description: "CEO publicly supported Pride Month campaigns.",
        source: { name: "CNN", date: "June 2025" },
        impact: { social: 3 },
      },
    ],
  },
];

const Trending = () => {
  const navigate = useNavigate();

  const getScoreColor = (score: number) => {
    if (score >= 70) return "bg-success/10 text-success border-success/20";
    if (score >= 40) return "bg-warning/10 text-warning border-warning/20";
    return "bg-danger/10 text-danger border-danger/20";
  };

  const getVelocityColor = (velocity: "rising" | "falling") => {
    return velocity === "rising" ? "text-success" : "text-danger";
  };

  const handleFollow = (brandName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toast({ title: "Following", description: `You're now following ${brandName}` });
  };

  const handleAvoid = (brandName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toast({ title: "Added to Avoid", description: `${brandName} added to your avoid list` });
  };

  const handleNotify = (brandName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toast({ title: "Notifications On", description: `You'll be notified of changes to ${brandName}` });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-card border-b">
        <div className="container max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Trending Brands</h1>
          </div>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-6">
        <div className="space-y-4">
          {trendingBrands.map((brand) => (
            <Card
              key={brand.id}
              className="cursor-pointer hover:shadow-md transition-all"
              onClick={() => navigate(`/brand/${brand.id}`)}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  {/* Score Badge */}
                  <div className={`flex flex-col items-center justify-center rounded-full border-2 w-16 h-16 shrink-0 ${getScoreColor(brand.score)}`}>
                    <div className="text-2xl font-bold">{brand.score}</div>
                    <div className="text-[10px] font-medium opacity-80">Score</div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-3">
                    {/* Header */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-lg">{brand.name}</h3>
                      <div className={`flex items-center gap-1 font-semibold text-sm ${getVelocityColor(brand.velocity)}`}>
                        {brand.velocity === "rising" ? (
                          <>
                            <TrendingUp className="h-4 w-4" />
                            +{brand.change}
                          </>
                        ) : (
                          <>
                            <TrendingDown className="h-4 w-4" />
                            {brand.change}
                          </>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground font-medium px-2 py-0.5 rounded-full bg-muted">
                        {brand.velocity === "rising" ? "rising fast" : "falling"}
                      </span>
                    </div>

                    {/* Events */}
                    <div className="space-y-2.5">
                      {brand.events.slice(0, 2).map((event, idx) => {
                        const config = categoryConfig[event.category];
                        const CategoryIcon = config.icon;
                        return (
                          <div key={idx} className="space-y-1">
                            {/* Category Badge */}
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={`flex items-center gap-1 ${config.color}`}>
                                <CategoryIcon className="h-3 w-3" />
                                {config.label}
                              </Badge>
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
                            <p className="text-xs text-muted-foreground/70 italic">
                              According to {event.source.name}, {event.source.date}
                            </p>
                          </div>
                        );
                      })}
                      
                      {brand.events.length > 2 && (
                        <Button 
                          variant="link" 
                          className="h-auto p-0 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/brand/${brand.id}`);
                          }}
                        >
                          View Full Timeline ({brand.events.length} events)
                        </Button>
                      )}
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs rounded-full"
                        onClick={(e) => handleFollow(brand.name, e)}
                      >
                        <Heart className="h-3 w-3" />
                        Follow
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs rounded-full"
                        onClick={(e) => handleAvoid(brand.name, e)}
                      >
                        <Ban className="h-3 w-3" />
                        Avoid
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs rounded-full"
                        onClick={(e) => handleNotify(brand.name, e)}
                      >
                        <Bell className="h-3 w-3" />
                        Notify
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Trending;
