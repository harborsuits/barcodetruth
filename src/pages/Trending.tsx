import { useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp, TrendingDown, Heart, Ban, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";
import { EventCard, type BrandEvent } from "@/components/EventCard";

const trendingBrands: Array<{
  id: string;
  name: string;
  score: number;
  velocity: "rising" | "falling";
  change: number;
  events: BrandEvent[];
}> = [
  {
    id: "nike",
    name: "Nike",
    score: 72,
    velocity: "falling",
    change: -8,
    events: [
      {
        category: "labor",
        description: "Workers at manufacturing facilities reported wage and safety concerns.",
        source: { name: "Reuters", date: "Sept 2025" },
        impact: { labor: -15, social: -5 },
        severity: "moderate",
      },
      {
        category: "labor",
        description: "Supplier audit disputes over working conditions.",
        source: { name: "Bloomberg", date: "July 2025" },
        impact: { labor: -8 },
        severity: "minor",
      },
    ],
  },
  {
    id: "patagonia",
    name: "Patagonia",
    score: 91,
    velocity: "rising",
    change: 12,
    events: [
      {
        category: "environment",
        description: "Launched comprehensive supply chain transparency initiative with third-party verification.",
        source: { name: "The Guardian", date: "Aug 2025", quote: "Patagonia's new initiative sets a new standard for supply chain transparency in the apparel industry." },
        impact: { environment: 15, social: 8 },
        verified: true,
      },
      {
        category: "labor",
        description: "Unionization disputes at distribution centers.",
        source: { name: "AP News", date: "May 2025" },
        impact: { labor: -5 },
        severity: "minor",
      },
    ],
  },
  {
    id: "amazon",
    name: "Amazon",
    score: 45,
    velocity: "falling",
    change: -15,
    events: [
      {
        category: "labor",
        description: "Multiple reports surfaced regarding warehouse working conditions.",
        source: { name: "New York Times", date: "Sept 2025", quote: "Warehouse workers described grueling conditions with limited breaks and intense productivity monitoring." },
        impact: { labor: -12, social: -8 },
        severity: "severe",
        verified: true,
      },
      {
        category: "politics",
        description: "Increased political spending disclosures raised concerns.",
        source: { name: "Washington Post", date: "Aug 2025" },
        impact: { politics: -10 },
        severity: "moderate",
      },
      {
        category: "environment",
        description: "Carbon emissions reduction targets announced.",
        source: { name: "Bloomberg", date: "June 2025" },
        impact: { environment: 8 },
        verified: true,
      },
    ],
  },
  {
    id: "allbirds",
    name: "Allbirds",
    score: 89,
    velocity: "rising",
    change: 7,
    events: [
      {
        category: "environment",
        description: "Released detailed carbon footprint data for all products and expanded sustainable materials program.",
        source: { name: "Bloomberg", date: "Aug 2025", quote: "Allbirds' transparency initiative includes detailed lifecycle analysis for every product in their catalog." },
        impact: { environment: 12, social: 5 },
        verified: true,
      },
      {
        category: "cultural-values",
        description: "CEO publicly supported Pride Month campaigns.",
        source: { name: "CNN", date: "June 2025" },
        impact: { social: 3 },
      },
    ],
  },
];

const Trending = () => {
  const navigate = useNavigate();
  const [brandActions, setBrandActions] = useState<Record<string, { following: boolean; avoiding: boolean; notifying: boolean }>>({});

  const getScoreColor = (score: number) => {
    if (score >= 70) return "bg-success/10 text-success border-success/20";
    if (score >= 40) return "bg-warning/10 text-warning border-warning/20";
    return "bg-danger/10 text-danger border-danger/20";
  };

  const getVelocityColor = (velocity: "rising" | "falling") => {
    return velocity === "rising" ? "text-success" : "text-danger";
  };

  const handleFollow = (brandId: string, brandName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBrandActions(prev => ({
      ...prev,
      [brandId]: { ...prev[brandId], following: !prev[brandId]?.following }
    }));
    toast({ 
      title: brandActions[brandId]?.following ? "Unfollowed" : "Following", 
      description: brandActions[brandId]?.following ? `Stopped following ${brandName}` : `You're now following ${brandName}` 
    });
  };

  const handleAvoid = (brandId: string, brandName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBrandActions(prev => ({
      ...prev,
      [brandId]: { ...prev[brandId], avoiding: !prev[brandId]?.avoiding }
    }));
    toast({ 
      title: brandActions[brandId]?.avoiding ? "Removed from Avoid" : "Added to Avoid", 
      description: brandActions[brandId]?.avoiding ? `${brandName} removed from avoid list` : `${brandName} added to your avoid list` 
    });
  };

  const handleNotify = (brandId: string, brandName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBrandActions(prev => ({
      ...prev,
      [brandId]: { ...prev[brandId], notifying: !prev[brandId]?.notifying }
    }));
    toast({ 
      title: brandActions[brandId]?.notifying ? "Notifications Off" : "Notifications On", 
      description: brandActions[brandId]?.notifying ? `Stopped notifications for ${brandName}` : `You'll be notified of changes to ${brandName}` 
    });
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
                      {brand.events.slice(0, 2).map((event, idx) => (
                        <EventCard key={idx} event={event} />
                      ))}
                      
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
                        variant={brandActions[brand.id]?.following ? "default" : "outline"}
                        size="sm"
                        className={`h-8 text-xs rounded-full transition-all ${
                          brandActions[brand.id]?.following ? "bg-success hover:bg-success/90" : ""
                        }`}
                        onClick={(e) => handleFollow(brand.id, brand.name, e)}
                      >
                        <Heart className={`h-3 w-3 ${brandActions[brand.id]?.following ? "fill-current" : ""}`} />
                        Follow
                      </Button>
                      <Button
                        variant={brandActions[brand.id]?.avoiding ? "default" : "outline"}
                        size="sm"
                        className={`h-8 text-xs rounded-full transition-all ${
                          brandActions[brand.id]?.avoiding ? "bg-danger hover:bg-danger/90" : ""
                        }`}
                        onClick={(e) => handleAvoid(brand.id, brand.name, e)}
                      >
                        <Ban className={`h-3 w-3 ${brandActions[brand.id]?.avoiding ? "fill-current" : ""}`} />
                        Avoid
                      </Button>
                      <Button
                        variant={brandActions[brand.id]?.notifying ? "default" : "outline"}
                        size="sm"
                        className={`h-8 text-xs rounded-full transition-all ${
                          brandActions[brand.id]?.notifying ? "bg-primary hover:bg-primary/90" : ""
                        }`}
                        onClick={(e) => handleNotify(brand.id, brand.name, e)}
                      >
                        <Bell className={`h-3 w-3 ${brandActions[brand.id]?.notifying ? "fill-current" : ""}`} />
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
