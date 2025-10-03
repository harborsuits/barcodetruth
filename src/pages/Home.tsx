import { useNavigate } from "react-router-dom";
import { TrendingUp, List, Settings, Search, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroSection } from "@/components/landing/HeroSection";
import { TrendingPreview } from "@/components/landing/TrendingPreview";
import { TrustedSources } from "@/components/landing/TrustedSources";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LatestVerifications } from "@/components/landing/LatestVerifications";
import { AttributionFooter } from "@/components/AttributionFooter";
import { useSnapshotPrewarm } from "@/hooks/useSnapshotPrewarm";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import logo from "@/assets/logo.png";

export const Home = () => {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  useSnapshotPrewarm(); // Prewarm snapshot cache for offline use

  useEffect(() => {
    const checkAdminRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: role } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();
        setIsAdmin(!!role);
      }
    };
    checkAdminRole();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b">
        <div className="container max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <img src={logo} alt="Barcode Truth" className="h-12 w-auto" />
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

      <main className="max-w-screen-md mx-auto px-4 sm:px-6 space-y-8 pb-24">
        <HeroSection />
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


