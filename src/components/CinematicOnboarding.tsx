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

  return (
    <div className="relative flex flex-col items-center justify-center h-full px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm space-y-3"
      >
        {/* Ownership banner — matches OwnershipReveal */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: phase >= 1 ? 1 : 0, x: phase >= 1 ? 0 : -10 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="bg-card border border-border p-4 flex items-center gap-3"
        >
          <div className="w-10 h-10 bg-muted flex items-center justify-center flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-muted-foreground">
              <path d="M3 21h18M3 7v1a3 3 0 006 0V7m0 0V4h6v3m0 0v1a3 3 0 006 0V7M6 21V11m12 10V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Owned By</p>
            <p className="text-base font-bold text-foreground">PepsiCo, Inc.</p>
          </div>
        </motion.div>

        {/* Trust Score — matches TrustVerdict */}
        <AnimatePresence>
          {phase >= 2 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="bg-destructive/10 border border-border p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Trust Score</p>
                  <div className="flex items-baseline gap-2">
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="text-5xl font-extrabold tracking-tighter text-destructive"
                    >
                      38
                    </motion.span>
                    <span className="text-sm text-muted-foreground font-mono">/100</span>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-destructive">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.15"/>
                    <path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <span className="text-sm font-bold font-mono uppercase tracking-wider text-destructive">Avoid</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Why reasons — matches TrustVerdict */}
        <AnimatePresence>
          {phase >= 3 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-1.5 px-1"
            >
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Why</p>
              {[
                "Multiple EPA violations on record",
                "Labor disputes in supply chain",
                "Political spending misaligned with stated values",
              ].map((reason, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.12 * i }}
                  className="flex items-start gap-2"
                >
                  <span className="text-warning text-xs mt-0.5">⚠</span>
                  <p className="text-sm text-foreground/80 leading-snug">{reason}</p>
                </motion.div>
              ))}
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
    { name: "Siete Chips", score: 82, initial: "S", env: 78 },
    { name: "Late July", score: 76, initial: "L", env: 71 },
    { name: "Beanfields", score: 71, initial: "B", env: 68 },
  ];

  const similarOptions = [
    { name: "Tostitos", parent: "PepsiCo", score: 35, initial: "T" },
    { name: "Pringles", parent: "Kellanova", score: 42, initial: "P" },
  ];

  const getScoreColor = (s: number) => {
    if (s >= 70) return "text-green-600";
    if (s >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="relative flex flex-col items-center justify-center h-full px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm space-y-4"
      >
        {/* Better Options */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: phase >= 1 ? 1 : 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-2"
        >
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-green-600">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.15"/>
              <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-sm font-semibold text-foreground">Better Options</span>
            <span className="text-[10px] text-muted-foreground">Independent & ethical picks</span>
          </div>
          {betterOptions.map((opt, i) => (
            <motion.div
              key={opt.name}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: phase >= 1 ? 1 : 0, x: phase >= 1 ? 0 : -8 }}
              transition={{ duration: 0.3, delay: 0.1 * i + 0.2 }}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-muted-foreground">{opt.initial}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-foreground">{opt.name}</span>
                    <span className={`text-sm font-bold ${getScoreColor(opt.score)}`}>{opt.score}</span>
                  </div>
                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    <span className="inline-flex items-center text-[10px] px-1.5 py-0 rounded-sm bg-green-500/10 text-green-600 border border-green-500/20">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="mr-0.5">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.15"/>
                      </svg>
                      Independent
                    </span>
                    <span className="inline-flex items-center text-[10px] px-1.5 py-0 rounded-sm border border-border text-muted-foreground">
                      Env {opt.env}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Similar Options */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: phase >= 2 ? 1 : 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-2"
        >
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-muted-foreground">
              <path d="M17 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 11V9a4 4 0 014-4h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M7 23l-4-4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M21 13v2a4 4 0 01-4 4H3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-sm font-semibold text-foreground">Similar Products</span>
            <span className="text-[10px] text-muted-foreground">Same category, different ownership</span>
          </div>
          {similarOptions.map((opt, i) => (
            <motion.div
              key={opt.name}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: phase >= 2 ? 1 : 0, x: phase >= 2 ? 0 : -8 }}
              transition={{ duration: 0.3, delay: 0.1 * i + 0.15 }}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-muted-foreground">{opt.initial}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-foreground/70">{opt.name}</span>
                    <span className={`text-sm font-bold ${getScoreColor(opt.score)}`}>{opt.score}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-muted-foreground">
                      <path d="M3 21h18M3 7v1a3 3 0 006 0V7m0 0V4h6v3m0 0v1a3 3 0 006 0V7M6 21V11m12 10V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="text-xs text-muted-foreground">{opt.parent}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
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
