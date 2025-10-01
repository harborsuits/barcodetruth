import { useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const trendingBrands = [
  {
    id: "nike",
    name: "Nike",
    score: 72,
    velocity: "falling",
    change: -8,
    reason: "Labor practice concerns",
  },
  {
    id: "patagonia",
    name: "Patagonia",
    score: 91,
    velocity: "rising",
    change: 12,
    reason: "New environmental initiatives",
  },
  {
    id: "amazon",
    name: "Amazon",
    score: 45,
    velocity: "falling",
    change: -15,
    reason: "Labor and political controversies",
  },
  {
    id: "allbirds",
    name: "Allbirds",
    score: 89,
    velocity: "rising",
    change: 7,
    reason: "Transparent supply chain updates",
  },
];

const Trending = () => {
  const navigate = useNavigate();

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-success";
    if (score >= 40) return "text-warning";
    return "text-danger";
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
        <div className="space-y-3">
          {trendingBrands.map((brand) => (
            <Card
              key={brand.id}
              className="cursor-pointer hover:bg-accent transition-colors"
              onClick={() => navigate(`/brand/${brand.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{brand.name}</h3>
                      <Badge
                        variant={brand.velocity === "rising" ? "default" : "destructive"}
                        className="flex items-center gap-1"
                      >
                        {brand.velocity === "rising" ? (
                          <>
                            <TrendingUp className="h-3 w-3" />
                            +{brand.change}
                          </>
                        ) : (
                          <>
                            <TrendingDown className="h-3 w-3" />
                            {brand.change}
                          </>
                        )}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{brand.reason}</p>
                  </div>
                  <div className={`text-2xl font-bold ${getScoreColor(brand.score)}`}>
                    {brand.score}
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
