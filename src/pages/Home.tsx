import { useNavigate, Link } from "react-router-dom";
import { ScanLine, Search, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroSection } from "@/components/landing/HeroSection";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { useSnapshotPrewarm } from "@/hooks/useSnapshotPrewarm";

export const Home = () => {
  const navigate = useNavigate();
  useSnapshotPrewarm();

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-screen-md mx-auto px-4 sm:px-6 pb-28 pt-6">
        <div className="space-y-10">
          <HeroSection />
          <HowItWorks />

          {/* Trust & methodology footer links */}
          <div className="pt-4 border-t border-border/10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <Link to="/how-scores-work" className="hover:text-foreground transition-colors underline-offset-4 hover:underline">
              How scores work
            </Link>
            <span className="text-muted-foreground/30">·</span>
            <Link to="/why-trust-us" className="hover:text-foreground transition-colors underline-offset-4 hover:underline">
              Why trust us
            </Link>
            <span className="text-muted-foreground/30">·</span>
            <Link to="/about" className="hover:text-foreground transition-colors underline-offset-4 hover:underline">
              About
            </Link>
          </div>
        </div>
      </main>

      {/* Bottom Nav — 3 consumer-first items. Admin moved to Settings. */}
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
          </div>
        </div>
      </nav>
    </div>
  );
};
