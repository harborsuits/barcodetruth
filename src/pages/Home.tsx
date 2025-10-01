import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ScanLine, TrendingUp, List, Settings } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const Home = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const recentScans = [
    { id: "nike", name: "Nike", score: 72 },
    { id: "patagonia", name: "Patagonia", score: 91 },
    { id: "amazon", name: "Amazon", score: 45 },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/brand/${searchQuery.toLowerCase()}`);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-success";
    if (score >= 40) return "text-warning";
    return "text-danger";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b">
        <div className="container max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">ShopSignals</h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/settings")}
            >
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Search */}
        <form onSubmit={handleSearch} className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search for a brand..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => navigate("/scan")}
          >
            <ScanLine className="mr-2 h-5 w-5" />
            Scan Barcode
          </Button>
        </form>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-24 flex-col gap-2"
            onClick={() => navigate("/trending")}
          >
            <TrendingUp className="h-6 w-6" />
            <span className="text-sm">Trending</span>
          </Button>
          <Button
            variant="outline"
            className="h-24 flex-col gap-2"
            onClick={() => navigate("/lists")}
          >
            <List className="h-6 w-6" />
            <span className="text-sm">My Lists</span>
          </Button>
        </div>

        {/* Recent Scans */}
        {recentScans.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Recent Scans</h2>
            <div className="space-y-2">
              {recentScans.map((brand) => (
                <Card
                  key={brand.id}
                  className="cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => navigate(`/brand/${brand.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{brand.name}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-2xl font-bold ${getScoreColor(brand.score)}`}>
                          {brand.score}
                        </span>
                        <span className="text-sm text-muted-foreground">/100</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t">
        <div className="container max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-around py-3">
            <Button variant="ghost" size="sm" className="flex-col gap-1 h-auto">
              <Search className="h-5 w-5" />
              <span className="text-xs">Search</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-col gap-1 h-auto"
              onClick={() => navigate("/trending")}
            >
              <TrendingUp className="h-5 w-5" />
              <span className="text-xs">Trending</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-col gap-1 h-auto"
              onClick={() => navigate("/lists")}
            >
              <List className="h-5 w-5" />
              <span className="text-xs">Lists</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-col gap-1 h-auto"
              onClick={() => navigate("/settings")}
            >
              <Settings className="h-5 w-5" />
              <span className="text-xs">Settings</span>
            </Button>
          </div>
        </div>
      </nav>
    </div>
  );
};

export default Home;
