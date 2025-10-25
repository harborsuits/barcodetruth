import { useNavigate } from "react-router-dom";
import { TrendingUp, List, Settings, Search, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/Header";
import { HeroSection } from "@/components/landing/HeroSection";
import { TrendingPreview } from "@/components/landing/TrendingPreview";
import { TrustedSources } from "@/components/landing/TrustedSources";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LatestVerifications } from "@/components/landing/LatestVerifications";
import { RecentVerifications } from "@/components/landing/RecentVerifications";
import { TopMovers24h } from "@/components/landing/TopMovers24h";
import { AttributionFooter } from "@/components/AttributionFooter";
import { SubscriptionBanner } from "@/components/SubscriptionBanner";
import { WelcomeTour } from "@/components/WelcomeTour";
import { useSnapshotPrewarm } from "@/hooks/useSnapshotPrewarm";
import { useIsAdmin } from "@/hooks/useIsAdmin";

export const Home = () => {
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  useSnapshotPrewarm(); // Prewarm snapshot cache for offline use

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header showSettings={true} showBack={false} />
      <WelcomeTour />

      <main className="max-w-screen-md mx-auto px-4 sm:px-6 space-y-8 pb-24">
        <HeroSection />
        <SubscriptionBanner />
        <TopMovers24h />
        <RecentVerifications />
        <LatestVerifications />
        <TrendingPreview />
        <HowItWorks />
        <TrustedSources />
        <AttributionFooter />
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur border-t">
        <div className="container max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-around py-3">
            <Button 
              variant="ghost" 
              size="sm" 
              className="flex-col gap-1 h-auto"
              onClick={() => navigate("/search")}
            >
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
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                className="flex-col gap-1 h-auto"
                onClick={() => navigate("/admin/health")}
              >
                <Shield className="h-5 w-5" />
                <span className="text-xs">Admin</span>
              </Button>
            )}
          </div>
        </div>
      </nav>
    </div>
  );
};


