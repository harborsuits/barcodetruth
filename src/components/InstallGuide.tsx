import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Smartphone, Share, Plus, MoreVertical, Download, ExternalLink } from "lucide-react";
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
  isPreviewMode?: boolean;
}

export function InstallGuide({ onContinue, isPreviewMode = false }: InstallGuideProps) {
  const [platform] = useState<Platform>(detectPlatform);
  const [canPrompt, setCanPrompt] = useState(false);

  useEffect(() => {
    setCanPrompt(isA2HSAvailable());
  }, []);

  useEffect(() => {
    if (!isPreviewMode && isStandalone()) {
      localStorage.setItem("installGuideShown", "true");
      onContinue();
    }
  }, [onContinue, isPreviewMode]);

  const handleNativeInstall = async () => {
    const accepted = await triggerA2HS();
    if (accepted) {
      if (!isPreviewMode) localStorage.setItem("installGuideShown", "true");
      onContinue();
    }
  };

  const handleSkip = () => {
    if (!isPreviewMode) localStorage.setItem("installGuideShown", "true");
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
            QUICK SETUP
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Scan instantly in-store
          </h1>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Add Barcode to your home screen so you can open it in one tap and scan products while shopping
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
              Add to Home Screen
            </Button>
            <p className="text-[10px] text-center text-muted-foreground font-mono">
              Takes 5 seconds · No app store needed
            </p>
          </div>
        )}

        {/* iOS instructions */}
        {platform === "ios" && !canPrompt && (
          <div className="space-y-4">
            <div className="bg-card border border-border p-5 space-y-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-primary/60">
                THIS ONLY TAKES 5 SECONDS
              </p>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm flex-shrink-0">
                  1
                </div>
                <div className="space-y-1.5">
                  <p className="font-semibold text-sm text-foreground">
                    Tap the Share icon
                  </p>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                      <Share className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Bottom of your Safari screen
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm flex-shrink-0">
                  2
                </div>
                <div className="space-y-1.5">
                  <p className="font-semibold text-sm text-foreground">
                    Tap "Add to Home Screen"
                  </p>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                      <Plus className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Scroll down in the share menu
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm flex-shrink-0">
                  3
                </div>
                <div className="space-y-1.5">
                  <p className="font-semibold text-sm text-foreground">
                    Open Barcode from your home screen
                  </p>
                  <span className="text-xs text-muted-foreground">
                    Now you can scan products in one tap while shopping
                  </span>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-center text-muted-foreground font-mono">
              Makes scanning way faster in-store · No app store needed
            </p>
          </div>
        )}

        {/* Android fallback (no native prompt) */}
        {platform === "android" && !canPrompt && (
          <div className="space-y-4">
            <div className="bg-card border border-border p-5 space-y-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-primary/60">
                THIS ONLY TAKES 5 SECONDS
              </p>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm flex-shrink-0">
                  1
                </div>
                <div className="space-y-1.5">
                  <p className="font-semibold text-sm text-foreground">
                    Tap the menu button
                  </p>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                      <MoreVertical className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Top-right corner of Chrome
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm flex-shrink-0">
                  2
                </div>
                <div className="space-y-1.5">
                  <p className="font-semibold text-sm text-foreground">
                    Tap "Add to Home Screen"
                  </p>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                      <Download className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      It'll appear on your home screen
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm flex-shrink-0">
                  3
                </div>
                <div className="space-y-1.5">
                  <p className="font-semibold text-sm text-foreground">
                    Open Barcode from your home screen
                  </p>
                  <span className="text-xs text-muted-foreground">
                    Now you can scan products in one tap while shopping
                  </span>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-center text-muted-foreground font-mono">
              Makes scanning way faster in-store · No app store needed
            </p>
          </div>
        )}

        {/* Desktop instructions */}
        {platform === "desktop" && !canPrompt && (
          <div className="bg-card border border-border p-5 space-y-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-primary/60">
              BEST EXPERIENCE ON MOBILE
            </p>
            <p className="text-sm text-muted-foreground">
              Barcode works best on your phone so you can scan products while shopping.
            </p>
            <div className="flex items-center gap-3 bg-muted/50 border border-border rounded-lg p-3">
              <ExternalLink className="w-4 h-4 text-primary flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">barcodetruth.com</p>
                <p className="text-[10px] text-muted-foreground">Open on your phone → Add to Home Screen</p>
              </div>
            </div>
          </div>
        )}

        {/* Continue / Skip */}
        <div className="space-y-3">
          <Button
            variant="outline"
            size="lg"
            onClick={handleSkip}
            className="w-full font-mono text-xs uppercase tracking-wider"
          >
            Continue without setup
          </Button>
        </div>

        <p className="text-[10px] text-center text-muted-foreground/50 font-mono uppercase tracking-wider">
          You can always add to home screen later from Settings
        </p>
      </div>
    </div>
  );
}
