import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Smartphone, Download, ExternalLink, ChevronRight } from "lucide-react";
import { triggerA2HS, isA2HSAvailable } from "@/lib/a2hs";
import { SafariShareMockup, ShareSheetMockup } from "./install-guide/SafariMockup";
import { ChromeMenuMockup, ChromeDropdownMockup } from "./install-guide/ChromeMockup";
import { HomeScreenMockup } from "./install-guide/HomeScreenMockup";

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
  const [step, setStep] = useState(0);

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

  // iOS steps: 0=intro, 1=share button, 2=share sheet, 3=home screen
  // Android steps: 0=intro, 1=menu button, 2=dropdown, 3=home screen
  const maxSteps = platform === "desktop" ? 0 : 3;

  const handleNext = () => {
    if (step >= maxSteps) {
      handleSkip();
    } else {
      setStep(step + 1);
    }
  };

  // Intro screen (step 0)
  if (step === 0) {
    return (
      <div className="min-h-screen bg-background forensic-grid p-4 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full mx-auto space-y-8"
        >
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
              <Smartphone className="w-8 h-8 text-primary" />
            </div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              QUICK SETUP · 5 SECONDS
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              Scan instantly in-store
            </h1>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Add Barcode to your home screen so you can open it in one tap and scan products while shopping
            </p>
          </div>

          {/* Native install (Android/desktop Chrome) */}
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

          {/* Desktop */}
          {platform === "desktop" && !canPrompt && (
            <div className="space-y-4">
              <div className="bg-card border border-border p-5 space-y-4 rounded-lg">
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
                    <p className="text-[10px] text-muted-foreground">Open on your phone → follow the steps</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Show Me How / Skip for iOS & Android */}
          {(platform === "ios" || platform === "android") && !canPrompt && (
            <div className="space-y-3">
              <Button
                size="lg"
                onClick={handleNext}
                className="w-full font-mono text-xs uppercase tracking-wider gap-2"
              >
                Show me how
                <ChevronRight className="w-4 h-4" />
              </Button>
              <p className="text-[10px] text-center text-muted-foreground font-mono">
                3 quick steps · No app store needed
              </p>
            </div>
          )}

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
        </motion.div>
      </div>
    );
  }

  // Visual step-by-step screens (steps 1–3)
  const iosSteps = [
    null, // step 0 is intro
    {
      number: 1,
      title: "Tap the Share button",
      subtitle: "At the bottom of your Safari screen",
      mockup: <SafariShareMockup />,
    },
    {
      number: 2,
      title: 'Tap "Add to Home Screen"',
      subtitle: "Scroll down in the share menu to find it",
      mockup: <ShareSheetMockup />,
    },
    {
      number: 3,
      title: "You're all set!",
      subtitle: "Open Barcode from your home screen to scan in one tap",
      mockup: <HomeScreenMockup />,
    },
  ];

  const androidSteps = [
    null,
    {
      number: 1,
      title: "Tap the ⋮ menu",
      subtitle: "Top-right corner of Chrome",
      mockup: <ChromeMenuMockup />,
    },
    {
      number: 2,
      title: 'Tap "Add to Home screen"',
      subtitle: "It's in the dropdown menu",
      mockup: <ChromeDropdownMockup />,
    },
    {
      number: 3,
      title: "You're all set!",
      subtitle: "Open Barcode from your home screen to scan in one tap",
      mockup: <HomeScreenMockup />,
    },
  ];

  const steps = platform === "ios" ? iosSteps : androidSteps;
  const currentStep = steps[step];

  if (!currentStep) return null;

  return (
    <div className="min-h-screen bg-background forensic-grid p-4 flex items-center justify-center">
      <div className="max-w-md w-full mx-auto space-y-6">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s === step
                  ? "w-8 bg-primary"
                  : s < step
                  ? "w-4 bg-primary/40"
                  : "w-4 bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Step indicator */}
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-center">
          STEP {currentStep.number} OF 3
        </p>

        {/* Title */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="text-center space-y-2">
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                {currentStep.title}
              </h2>
              <p className="text-sm text-muted-foreground">
                {currentStep.subtitle}
              </p>
            </div>

            {/* Visual mockup */}
            <div className="py-4">
              {currentStep.mockup}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="space-y-3">
          <Button
            size="lg"
            onClick={handleNext}
            className="w-full font-mono text-xs uppercase tracking-wider gap-2"
          >
            {step === maxSteps ? "Get Started" : "Next"}
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            className="w-full font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
          >
            Skip setup
          </Button>
        </div>
      </div>
    </div>
  );
}
