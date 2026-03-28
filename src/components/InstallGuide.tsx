import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Smartphone, Share, Plus, MoreVertical, Download, X } from "lucide-react";
import { triggerA2HS, isA2HSAvailable } from "@/lib/a2hs";

type Platform = "ios" | "android" | "desktop";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
}

interface InstallGuideProps {
  onContinue: () => void;
}

export function InstallGuide({ onContinue }: InstallGuideProps) {
  const [platform] = useState<Platform>(detectPlatform);
  const [canPrompt, setCanPrompt] = useState(false);

  useEffect(() => {
    setCanPrompt(isA2HSAvailable());
  }, []);

  // If already installed as standalone, skip
  useEffect(() => {
    if (isStandalone()) {
      localStorage.setItem("installGuideShown", "true");
      onContinue();
    }
  }, [onContinue]);

  const handleNativeInstall = async () => {
    const accepted = await triggerA2HS();
    if (accepted) {
      localStorage.setItem("installGuideShown", "true");
      onContinue();
    }
  };

  const handleSkip = () => {
    localStorage.setItem("installGuideShown", "true");
    onContinue();
  };

  return (
    <div className="min-h-screen bg-background forensic-grid p-4 flex items-center justify-center">
      <div className="max-w-md w-full mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
            <Smartphone className="w-8 h-8 text-primary" />
          </div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            QUICK_SETUP
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Scan faster next time
          </h1>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Add Barcode to your home screen so you can open it instantly in the store
          </p>
        </div>

        {/* Native install button (Android/desktop Chrome) */}
        {canPrompt && (
          <div className="space-y-3">
            <Button
              size="lg"
              onClick={handleNativeInstall}
              className="w-full font-mono text-xs uppercase tracking-wider gap-2"
            >
              <Download className="w-4 h-4" />
              Install Barcode App
            </Button>
            <p className="text-[10px] text-center text-muted-foreground font-mono">
              Takes 5 seconds · No app store needed
            </p>
          </div>
        )}

        {/* iOS instructions */}
        {platform === "ios" && !canPrompt && (
          <div className="space-y-4">
            <div className="bg-card border border-border p-5 space-y-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-primary/60">
                2 QUICK STEPS
              </p>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm flex-shrink-0">
                  1
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-sm text-foreground">
                    Tap the Share button
                  </p>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Share className="w-4 h-4" />
                    <span className="text-xs">Bottom of your Safari screen</span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm flex-shrink-0">
                  2
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-sm text-foreground">
                    Tap "Add to Home Screen"
                  </p>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Plus className="w-4 h-4" />
                    <span className="text-xs">Scroll down in the share menu</span>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-center text-muted-foreground font-mono">
              Opens instantly like a real app · No app store needed
            </p>
          </div>
        )}

        {/* Android fallback (no native prompt) */}
        {platform === "android" && !canPrompt && (
          <div className="space-y-4">
            <div className="bg-card border border-border p-5 space-y-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-primary/60">
                2 QUICK STEPS
              </p>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm flex-shrink-0">
                  1
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-sm text-foreground">
                    Tap the menu button
                  </p>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MoreVertical className="w-4 h-4" />
                    <span className="text-xs">Top-right corner of Chrome</span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm flex-shrink-0">
                  2
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-sm text-foreground">
                    Tap "Install app" or "Add to Home Screen"
                  </p>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Download className="w-4 h-4" />
                    <span className="text-xs">It'll appear on your home screen</span>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-center text-muted-foreground font-mono">
              Opens instantly like a real app · No app store needed
            </p>
          </div>
        )}

        {/* Desktop instructions */}
        {platform === "desktop" && !canPrompt && (
          <div className="bg-card border border-border p-5 space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-primary/60">
              BEST ON MOBILE
            </p>
            <p className="text-sm text-muted-foreground">
              Barcode works best on your phone so you can scan products in the store.
              Visit <span className="text-primary font-medium">barcodetruth.lovable.app</span> on 
              your phone to install it.
            </p>
          </div>
        )}

        {/* Continue / Skip */}
        <div className="space-y-3">
          <Button
            variant="outline"
            size="lg"
            onClick={handleSkip}
            className="w-full font-mono text-xs uppercase tracking-wider gap-2"
          >
            {platform === "ios" || (platform === "android" && !canPrompt)
              ? "I'll do this later"
              : "Continue without installing"}
          </Button>
        </div>

        <p className="text-[10px] text-center text-muted-foreground/50 font-mono uppercase tracking-wider">
          You can always install later from Settings
        </p>
      </div>
    </div>
  );
}
