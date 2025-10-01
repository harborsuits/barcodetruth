import { useNavigate } from "react-router-dom";
import { TrendingUp, List, Settings, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroSection } from "@/components/landing/HeroSection";
import { TrendingPreview } from "@/components/landing/TrendingPreview";
import { TrustedSources } from "@/components/landing/TrustedSources";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { AttributionFooter } from "@/components/AttributionFooter";

export const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b">
        <div className="container max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              ShopSignals
            </h1>
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

      <main className="pb-24">
        <HeroSection />
        <TrendingPreview />
        <HowItWorks />
        <TrustedSources />
        
        <div className="max-w-5xl mx-auto px-4">
          <AttributionFooter />
        </div>
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur border-t">
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


