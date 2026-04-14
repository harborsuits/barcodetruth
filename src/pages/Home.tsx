import { useNavigate } from "react-router-dom";
import { ScanLine, Search, Settings, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroSection } from "@/components/landing/HeroSection";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { useSnapshotPrewarm } from "@/hooks/useSnapshotPrewarm";
import { useIsAdmin } from "@/hooks/useIsAdmin";

export const Home = () => {
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  useSnapshotPrewarm();

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-screen-md mx-auto px-4 sm:px-6 pb-24 pt-6">
        <div className="space-y-10">
          <HeroSection />
          <HowItWorks />
        </div>
      </main>

      {/* Bottom Nav — 3 core items */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-xl border-t border-border/10 z-50">
        <div className="container max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-around py-2">
            {[
              { icon: ScanLine, label: "Scan", path: "/scan" },
              { icon: Search, label: "Search", path: "/search" },
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
                <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
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
                <span className="text-[10px] font-medium uppercase tracking-wider">Admin</span>
              </Button>
            )}
          </div>
        </div>
      </nav>
    </div>
  );
};
