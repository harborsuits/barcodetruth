import { useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp, TrendingDown, Heart, Ban, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";
import { EventCard, type BrandEvent } from "@/components/EventCard";
import { topImpacts } from "@/lib/events";
import { AttributionFooter } from "@/components/AttributionFooter";

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
        event_id: "nike_labor_2025",
        brand_id: "nike",
        category: "labor",
        description: "Workers at manufacturing facilities reported wage and safety concerns.",
        date: "2025-09-15",
        severity: "moderate",
        verification: "corroborated",
        orientation: "negative",
        impact: { labor: -15, social: -5 },
        sources: [
          {
            name: "Reuters",
            date: "2025-09-15",
            url: "https://reuters.com/nike-labor-2025",
            quote: "Workers reported extended shifts without adequate breaks, raising concerns about workplace conditions."
          },
          {
            name: "Bloomberg",
            date: "2025-09-16",
            url: "https://bloomberg.com/nike-audit-2025",
            quote: "Independent audits confirmed discrepancies in wage calculations at supplier facilities."
          }
        ],
        jurisdiction: "Southeast Asia",
      },
      {
        event_id: "nike_labor_july",
        brand_id: "nike",
        category: "labor",
        description: "Supplier audit disputes over working conditions.",
        date: "2025-07-10",
        severity: "minor",
        verification: "corroborated",
        orientation: "negative",
        impact: { labor: -8 },
        sources: [
          { name: "Bloomberg", date: "2025-07-10" }
        ],
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
        event_id: "patagonia_env_2025",
        brand_id: "patagonia",
        category: "environment",
        description: "Launched comprehensive supply chain transparency initiative with third-party verification.",
        date: "2025-08-20",
        verification: "official",
        orientation: "positive",
        impact: { environment: 15, social: 8 },
        sources: [
          {
            name: "The Guardian",
            date: "2025-08-20",
            url: "https://theguardian.com/patagonia-transparency-2025",
            quote: "Patagonia's new initiative sets a new standard for supply chain transparency in the apparel industry."
          },
          {
            name: "Environmental Working Group",
            date: "2025-08-21",
            url: "https://ewg.org/patagonia-certification",
            quote: "Third-party auditors confirmed compliance with the highest environmental standards."
          }
        ],
        jurisdiction: "Global",
      },
      {
        event_id: "patagonia_labor_may",
        brand_id: "patagonia",
        category: "labor",
        description: "Unionization disputes at distribution centers.",
        date: "2025-05-15",
        severity: "minor",
        verification: "corroborated",
        orientation: "negative",
        impact: { labor: -5 },
        sources: [
          { name: "AP News", date: "2025-05-15" }
        ],
        company_response: {
          date: "2025-05-20",
          url: "https://patagonia.com/labor-response",
          summary: "Company committed to ongoing dialogue with workers and third-party mediation."
        },
        resolved: true,
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
        event_id: "amazon_labor_sept",
        brand_id: "amazon",
        category: "labor",
        description: "Multiple reports surfaced regarding warehouse working conditions.",
        date: "2025-09-10",
        severity: "severe",
        verification: "corroborated",
        orientation: "negative",
        impact: { labor: -12, social: -8 },
        sources: [
          {
            name: "New York Times",
            date: "2025-09-10",
            url: "https://nytimes.com/amazon-warehouse-2025",
            quote: "Warehouse workers described grueling conditions with limited breaks and intense productivity monitoring."
          },
          {
            name: "ProPublica",
            date: "2025-09-11",
            url: "https://propublica.org/amazon-investigation",
            quote: "Investigation found injury rates at Amazon warehouses significantly exceed industry averages."
          }
        ],
        jurisdiction: "US",
      },
      {
        event_id: "amazon_politics_aug",
        brand_id: "amazon",
        category: "politics",
        description: "Increased political spending disclosures raised concerns.",
        date: "2025-08-05",
        severity: "moderate",
        verification: "official",
        orientation: "negative",
        impact: { politics: -10 },
        sources: [
          {
            name: "Federal Election Commission",
            date: "2025-08-05",
            url: "https://fec.gov/amazon-pac-2025",
            quote: "Amazon PAC increased lobbying expenditures by 45% compared to previous year."
          }
        ],
        jurisdiction: "US",
      },
      {
        event_id: "amazon_env_june",
        brand_id: "amazon",
        category: "environment",
        description: "Carbon emissions reduction targets announced.",
        date: "2025-06-15",
        verification: "official",
        orientation: "positive",
        impact: { environment: 8 },
        sources: [
          {
            name: "Bloomberg",
            date: "2025-06-15",
            url: "https://bloomberg.com/amazon-climate-2025",
            quote: "Amazon pledged to achieve net-zero carbon by 2040 with significant investments in renewable energy."
          }
        ],
        jurisdiction: "Global",
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
        event_id: "allbirds_env_aug",
        brand_id: "allbirds",
        category: "environment",
        description: "Released detailed carbon footprint data for all products and expanded sustainable materials program.",
        date: "2025-08-10",
        verification: "official",
        orientation: "positive",
        impact: { environment: 12, social: 5 },
        sources: [
          {
            name: "Bloomberg",
            date: "2025-08-10",
            url: "https://bloomberg.com/allbirds-carbon-2025",
            quote: "Allbirds' transparency initiative includes detailed lifecycle analysis for every product in their catalog."
          }
        ],
        jurisdiction: "Global",
      },
      {
        event_id: "allbirds_cultural_june",
        brand_id: "allbirds",
        category: "cultural-values",
        description: "CEO publicly supported Pride Month campaigns.",
        date: "2025-06-01",
        verification: "unverified",
        orientation: "mixed",
        impact: { social: 3 },
        sources: [
          { name: "CNN", date: "2025-06-01" }
        ],
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
                      <Badge variant="outline" className="text-xs font-medium">
                        {brand.velocity === "rising" ? "rising fast" : "falling"}
                      </Badge>
                    </div>

                    {/* Events */}
                    <div className="space-y-2.5">
                      {brand.events.slice(0, 2).map((event, idx) => (
                        <EventCard key={idx} event={event} compact />
                      ))}
                      
                      {brand.events.length > 2 && (
                        <Button 
                          variant="link" 
                          className="h-auto p-0 text-xs group"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/brand/${brand.id}`);
                          }}
                          aria-label={`View full timeline of ${brand.events.length} events for ${brand.name}`}
                        >
                          View Full Timeline ({brand.events.length} events)
                          <span className="inline-block ml-1 transition-transform group-hover:translate-x-1">→</span>
                        </Button>
                      )}
                    </div>

                    {/* Why it matters */}
                    {(() => {
                      const impacts = topImpacts(brand.events[0]?.impact, 2)
                        .map(({ key, val }) => `${val > 0 ? '+' : ''}${val} ${key.charAt(0).toUpperCase() + key.slice(1)}`)
                        .join(' • ');
                      return impacts ? (
                        <div className="pt-2 border-t">
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium">Why it matters:</span> {impacts}
                          </p>
                        </div>
                      ) : null;
                    })()}

                    {/* Quick Actions */}
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        variant={brandActions[brand.id]?.following ? "default" : "outline"}
                        size="sm"
                        className={`h-8 text-xs rounded-full transition-all ${
                          brandActions[brand.id]?.following ? "bg-success hover:bg-success/90" : ""
                        }`}
                        onClick={(e) => handleFollow(brand.id, brand.name, e)}
                        aria-label={`${brandActions[brand.id]?.following ? "Unfollow" : "Follow"} ${brand.name}`}
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
                        aria-label={`${brandActions[brand.id]?.avoiding ? "Remove from avoid list" : "Add to avoid list"} ${brand.name}`}
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
                        aria-label={`${brandActions[brand.id]?.notifying ? "Turn off notifications" : "Turn on notifications"} for ${brand.name}`}
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
        
        {/* Attribution Footer */}
        <AttributionFooter />
      </main>
    </div>
  );
};

export default Trending;
