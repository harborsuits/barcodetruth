import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface CinematicOnboardingProps {
  onComplete: () => void;
  isPreviewMode?: boolean;
}

// ─── Slide 1: Scan ───────────────────────────────────────
function ScanSlide() {
  const [phase, setPhase] = useState(0);
  
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 400);   // scanner frame appears
    const t2 = setTimeout(() => setPhase(2), 1000);   // laser sweep
    const t3 = setTimeout(() => setPhase(3), 1800);   // barcode recognized
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div className="relative flex flex-col items-center justify-center h-full">
      {/* Scanner viewfinder */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-64 h-64 sm:w-72 sm:h-72"
      >
        {/* Corner brackets */}
        <div className="absolute inset-0">
          {/* Top-left */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: phase >= 1 ? 1 : 0 }}
            className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-primary"
          />
          {/* Top-right */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: phase >= 1 ? 1 : 0 }}
            transition={{ delay: 0.05 }}
            className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-primary"
          />
          {/* Bottom-left */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: phase >= 1 ? 1 : 0 }}
            transition={{ delay: 0.1 }}
            className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-primary"
          />
          {/* Bottom-right */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: phase >= 1 ? 1 : 0 }}
            transition={{ delay: 0.15 }}
            className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-primary"
          />
        </div>

        {/* Barcode lines */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex gap-[3px] items-end h-24">
            {[16,28,12,32,8,24,20,36,14,28,10,32,18,26,14,30,12,22,34,16,28,20,10,26].map((h, i) => (
              <motion.div
                key={i}
                initial={{ height: 0, opacity: 0 }}
                animate={{ 
                  height: phase >= 1 ? h : 0, 
                  opacity: phase >= 1 ? 0.6 : 0 
                }}
                transition={{ duration: 0.4, delay: 0.02 * i, ease: "easeOut" }}
                className="w-[2px] bg-foreground/40"
              />
            ))}
          </div>
        </div>

        {/* Scan laser line */}
        <motion.div
          initial={{ top: "20%", opacity: 0 }}
          animate={{ 
            top: phase >= 2 ? ["20%", "80%", "50%"] : "20%",
            opacity: phase >= 2 ? [0, 1, 0.8] : 0,
          }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
          className="absolute left-2 right-2 h-[2px] bg-accent shadow-[0_0_12px_hsl(var(--accent)),0_0_24px_hsl(var(--accent)/0.4)]"
        />

        {/* Recognition flash */}
        <AnimatePresence>
          {phase >= 3 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.15, 0] }}
              transition={{ duration: 0.6 }}
              className="absolute inset-0 bg-primary"
            />
          )}
        </AnimatePresence>

        {/* Lock-on indicator */}
        <AnimatePresence>
          {phase >= 3 && (
            <motion.div
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2"
            >
              <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_hsl(142_76%_36%)]" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-green-500">
                PRODUCT_IDENTIFIED
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ─── Slide 2: Reveal ─────────────────────────────────────
function RevealSlide() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 300);
    const t2 = setTimeout(() => setPhase(2), 800);
    const t3 = setTimeout(() => setPhase(3), 1400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const rows = [
    { label: "PRODUCT", value: "Doritos Nacho Cheese", delay: 0 },
    { label: "BRAND", value: "Doritos", delay: 0.1 },
    { label: "PARENT_COMPANY", value: "PepsiCo, Inc.", delay: 0.2 },
    { label: "COMPANY_TYPE", value: "Public Corporation", delay: 0.3 },
  ];

  return (
    <div className="relative flex flex-col items-center justify-center h-full px-6">
      {/* Mock profile card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm border border-border bg-card/80 backdrop-blur-sm"
      >
        {/* Header bar */}
        <div className="border-b border-border px-4 py-3 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            BRAND_DOSSIER
          </span>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: phase >= 1 ? 48 : 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="h-1 bg-primary/40 overflow-hidden"
          />
        </div>

        {/* Data rows */}
        <div className="divide-y divide-border/50">
          {rows.map((row, i) => (
            <motion.div
              key={row.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ 
                opacity: phase >= 1 ? 1 : 0, 
                x: phase >= 1 ? 0 : -10 
              }}
              transition={{ duration: 0.4, delay: row.delay + 0.2 }}
              className="px-4 py-3 flex items-center justify-between"
            >
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                {row.label}
              </span>
              <span className={`text-sm font-medium ${i === 2 ? "text-accent" : "text-foreground"}`}>
                {row.value}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Score section */}
        <AnimatePresence>
          {phase >= 2 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="border-t border-border"
            >
              <div className="px-4 py-4 flex items-center justify-between">
                <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                  ALIGNMENT_SCORE
                </span>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-1.5 bg-muted overflow-hidden">
                    <motion.div
                      initial={{ width: "0%" }}
                      animate={{ width: "38%" }}
                      transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                      className="h-full bg-accent"
                    />
                  </div>
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="font-mono text-lg font-bold text-accent"
                  >
                    38
                  </motion.span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Ownership chain reveal */}
        <AnimatePresence>
          {phase >= 3 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="border-t border-accent/20 bg-accent/5"
            >
              <div className="px-4 py-3 flex items-center gap-2">
                <div className="w-1 h-6 bg-accent/40" />
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-widest text-accent/70">
                    OWNERSHIP_CHAIN
                  </p>
                  <p className="text-xs text-foreground/80">
                    Doritos → Frito-Lay → <span className="text-accent font-medium">PepsiCo</span>
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ─── Slide 3: Compare ────────────────────────────────────
function CompareSlide() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 400);
    const t2 = setTimeout(() => setPhase(2), 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const betterOptions = [
    { name: "Siete Chips", type: "Independent", score: 82 },
    { name: "Late July", type: "Independent", score: 76 },
    { name: "Beanfields", type: "Independent", score: 71 },
  ];

  const similarOptions = [
    { name: "Tostitos", type: "PepsiCo", score: 35 },
    { name: "Pringles", type: "Kellanova", score: 42 },
  ];

  return (
    <div className="relative flex flex-col items-center justify-center h-full px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm space-y-3"
      >
        {/* Better Options */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: phase >= 1 ? 1 : 0 }}
          transition={{ duration: 0.4 }}
          className="border border-border bg-card/80"
        >
          <div className="px-4 py-2 border-b border-border flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-green-500/80">
              BETTER_OPTIONS
            </span>
          </div>
          <div className="divide-y divide-border/30">
            {betterOptions.map((opt, i) => (
              <motion.div
                key={opt.name}
                initial={{ opacity: 0, x: -8 }}
                animate={{ 
                  opacity: phase >= 1 ? 1 : 0, 
                  x: phase >= 1 ? 0 : -8 
                }}
                transition={{ duration: 0.3, delay: 0.1 * i + 0.2 }}
                className="px-4 py-2.5 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{opt.name}</p>
                  <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                    {opt.type}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-12 h-1 bg-muted overflow-hidden">
                    <motion.div
                      initial={{ width: "0%" }}
                      animate={{ width: `${opt.score}%` }}
                      transition={{ duration: 0.6, delay: 0.1 * i + 0.4 }}
                      className="h-full bg-green-500/70"
                    />
                  </div>
                  <span className="font-mono text-xs font-bold text-green-500">{opt.score}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Similar Options */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: phase >= 2 ? 1 : 0 }}
          transition={{ duration: 0.4 }}
          className="border border-border/60 bg-card/50"
        >
          <div className="px-4 py-2 border-b border-border/40 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
              SIMILAR_OPTIONS
            </span>
          </div>
          <div className="divide-y divide-border/20">
            {similarOptions.map((opt, i) => (
              <motion.div
                key={opt.name}
                initial={{ opacity: 0, x: -8 }}
                animate={{ 
                  opacity: phase >= 2 ? 1 : 0, 
                  x: phase >= 2 ? 0 : -8 
                }}
                transition={{ duration: 0.3, delay: 0.1 * i + 0.15 }}
                className="px-4 py-2.5 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm text-foreground/70">{opt.name}</p>
                  <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">
                    {opt.type}
                  </p>
                </div>
                <span className="font-mono text-xs text-muted-foreground">{opt.score}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

// ─── Main Onboarding Container ───────────────────────────
const slides = [
  { id: "scan", title: "Scan any product", Component: ScanSlide },
  { id: "reveal", title: "See who owns it", Component: RevealSlide },
  { id: "compare", title: "Find better options", Component: CompareSlide },
];

export function CinematicOnboarding({ onComplete, isPreviewMode = false }: CinematicOnboardingProps) {
  const [current, setCurrent] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [userInteracted, setUserInteracted] = useState(false);

  // Autoplay: advance every 7.5s, pause after any manual interaction
  useEffect(() => {
    if (!autoplay || userInteracted) return;
    const timer = setTimeout(() => {
      if (current < slides.length - 1) {
        setCurrent(c => c + 1);
      } else {
        setAutoplay(false);
      }
    }, 7500);
    return () => clearTimeout(timer);
  }, [current, autoplay, userInteracted]);

  const goNext = useCallback(() => {
    setAutoplay(false);
    setUserInteracted(true);
    if (current < slides.length - 1) {
      setCurrent(c => c + 1);
    } else {
      if (!isPreviewMode) {
        localStorage.setItem("cinematicOnboardingSeen", "true");
      }
      onComplete();
    }
  }, [current, onComplete, isPreviewMode]);

  const skip = useCallback(() => {
    if (!isPreviewMode) {
      localStorage.setItem("cinematicOnboardingSeen", "true");
    }
    onComplete();
  }, [onComplete, isPreviewMode]);

  const handleComplete = useCallback(() => {
    if (!isPreviewMode) {
      localStorage.setItem("cinematicOnboardingSeen", "true");
    }
    onComplete();
  }, [onComplete, isPreviewMode]);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden">
      {/* Skip button */}
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={skip}
          className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 hover:text-foreground/80 transition-colors px-3 py-2"
        >
          SKIP
        </button>
      </div>

      {/* Slide content */}
      <div className="flex-1 relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={slides[current].id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="absolute inset-0"
          >
            {(() => {
              const Comp = slides[current].Component;
              return <Comp />;
            })()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom: title + progress + CTA */}
      <div className="relative z-10 pb-10 pt-6 px-6 flex flex-col items-center gap-6">
        {/* Slide title */}
        <AnimatePresence mode="wait">
          <motion.h2
            key={slides[current].id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            className="text-xl sm:text-2xl font-bold text-foreground text-center"
          >
            {slides[current].title}
          </motion.h2>
        </AnimatePresence>

        {/* Progress dots */}
        <div className="flex gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => { setAutoplay(false); setUserInteracted(true); setCurrent(i); }}
              className="p-1"
            >
              <div
                className={`h-1 transition-all duration-300 ${
                  i === current 
                    ? "w-6 bg-primary" 
                    : i < current 
                      ? "w-3 bg-primary/40" 
                      : "w-3 bg-muted"
                }`}
              />
            </button>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={current === slides.length - 1 ? handleComplete : goNext}
          className="font-mono text-xs uppercase tracking-widest text-primary-foreground bg-primary hover:bg-primary/90 px-8 py-3 transition-colors"
        >
          {current === slides.length - 1 ? "Get Started" : "Continue"}
        </button>
      </div>
    </div>
  );
}
