import { useNavigate } from "react-router-dom";
import { TrendingUp, List, Settings, Search, Shield, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HeroSection } from "@/components/landing/HeroSection";
import { QuickDemo } from "@/components/landing/QuickDemo";
import { TrendingPreview } from "@/components/landing/TrendingPreview";
import { TrustedSources } from "@/components/landing/TrustedSources";
import { RecentVerifications } from "@/components/landing/RecentVerifications";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { AttributionFooter } from "@/components/AttributionFooter";
import { SubscriptionBanner } from "@/components/SubscriptionBanner";
import { WelcomeTour } from "@/components/WelcomeTour";
import { useSnapshotPrewarm } from "@/hooks/useSnapshotPrewarm";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import MyScansTab from "@/components/MyScansTab";

export const Home = () => {
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  useSnapshotPrewarm();

  return (
    <div className="min-h-screen bg-background forensic-grid">
      <WelcomeTour />

      <main className="max-w-screen-md mx-auto px-4 sm:px-6 pb-24">
        <Tabs defaultValue="discover" className="space-y-8">
          <div className="sticky top-[52px] z-10 bg-background/95 backdrop-blur-xl pt-4 pb-3 -mx-4 px-4">
            <TabsList className="grid w-full grid-cols-2 bg-elevated-1 border border-border/10 p-0.5">
              <TabsTrigger 
                value="discover"
                className="font-mono text-xs uppercase tracking-widest data-[state=active]:bg-elevated-2 data-[state=active]:text-primary data-[state=active]:shadow-none"
              >
                Discover
              </TabsTrigger>
              <TabsTrigger 
                value="my-scans"
                className="font-mono text-xs uppercase tracking-widest data-[state=active]:bg-elevated-2 data-[state=active]:text-primary data-[state=active]:shadow-none"
              >
                My Scans
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="discover" className="space-y-10 mt-0">
            <HeroSection />
            <QuickDemo />
            <TrendingPreview />
            <RecentVerifications />
            <HowItWorks />
            <TrustedSources />
            <SubscriptionBanner />
            <AttributionFooter />
          </TabsContent>

          <TabsContent value="my-scans" className="mt-0">
            <MyScansTab />
          </TabsContent>
        </Tabs>
      </main>

      {/* Bottom Nav — Forensic HUD */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-xl border-t border-border/10 z-50">
        <div className="container max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-around py-2">
            {[
              { icon: ScanLine, label: "Scan", path: "/scan" },
              { icon: Search, label: "Search", path: "/search" },
              { icon: TrendingUp, label: "Trending", path: "/trending" },
              { icon: Settings, label: "Settings", path: "/settings" },
            ].map(({ icon: Icon, label, path }) => (
              <Button
                key={path}
                variant="ghost"
                size="sm"
                className="flex-col gap-0.5 h-auto py-2 px-3 text-muted-foreground hover:text-primary hover:bg-transparent transition-colors"
                onClick={() => navigate(path)}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-mono uppercase tracking-wider">{label}</span>
              </Button>
            ))}
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                className="flex-col gap-0.5 h-auto py-2 px-3 text-muted-foreground hover:text-warning hover:bg-transparent transition-colors"
                onClick={() => navigate("/admin/health")}
              >
                <Shield className="h-5 w-5" />
                <span className="text-[10px] font-mono uppercase tracking-wider">Admin</span>
              </Button>
            )}
          </div>
        </div>
      </nav>
    </div>
  );
};
