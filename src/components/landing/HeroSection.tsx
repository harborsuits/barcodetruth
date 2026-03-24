import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ScanLine } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

/* ── Bar pattern: width (px), height (fraction of max) ── */
const BAR_DATA = [
  [3,0.7],[1,0.5],[4,0.9],[2,0.6],[1,0.4],[3,0.8],[1,0.5],[2,0.7],
  [4,1],[1,0.3],[3,0.6],[2,0.8],[1,0.5],[3,0.9],[2,0.4],[1,0.7],
  [4,0.85],[2,0.55],[1,0.4],[3,0.75],[1,0.6],[2,0.9],[3,0.5],[1,0.3],
  [4,0.95],[2,0.65],[1,0.45],[3,0.8],[2,0.7],[1,0.5],[3,0.6],[4,0.85],
  [1,0.4],[2,0.7],[3,0.9],[1,0.55],[2,0.6],[4,0.75],[1,0.4],[3,0.8],
];

const MAX_H = 120; // max bar height px
const SCAN_DURATION = 2200; // ms for laser to cross
const GRADE_COLORS = ["good","mid","good","good","bad","good","mid","good","good","good",
  "mid","good","good","good","mid","good","good","good","mid","good",
  "good","good","mid","good","good","good","mid","good","good","good",
  "good","good","mid","good","good","good","good","good","mid","good"];

export function HeroSection() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [phase, setPhase] = useState<"idle"|"scanning"|"revealing"|"done">("idle");
  const [scanProgress, setScanProgress] = useState(0); // 0-1
  const [revealed, setRevealed] = useState<boolean[]>(new Array(BAR_DATA.length).fill(false));
  const rafRef = useRef<number>(0);
  const startRef = useRef(0);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
  };

  /* Start scan automatically after mount */
  useEffect(() => {
    const t = setTimeout(() => setPhase("scanning"), 1200);
    return () => clearTimeout(t);
  }, []);

  /* Animate laser across barcode */
  const tick = useCallback((now: number) => {
    if (!startRef.current) startRef.current = now;
    const elapsed = now - startRef.current;
    const p = Math.min(elapsed / SCAN_DURATION, 1);
    setScanProgress(p);

    // reveal bars as laser passes
    const barIdx = Math.floor(p * BAR_DATA.length);
    setRevealed(prev => {
      const next = [...prev];
      for (let i = 0; i <= barIdx && i < next.length; i++) next[i] = true;
      return next;
    });

    if (p < 1) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      setPhase("done");
    }
  }, []);

  useEffect(() => {
    if (phase === "scanning") {
      startRef.current = 0;
      rafRef.current = requestAnimationFrame(tick);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [phase, tick]);

  /* Restart loop */
  useEffect(() => {
    if (phase === "done") {
      const t = setTimeout(() => {
        setRevealed(new Array(BAR_DATA.length).fill(false));
        setScanProgress(0);
        setPhase("scanning");
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const totalW = BAR_DATA.reduce((s, [w]) => s + w + 2, 0); // bars + gaps

  return (
    <section className="w-full py-12 sm:py-20 relative overflow-hidden">
      {/* Radial glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.div
          animate={{ opacity: phase === "done" ? 0.3 : 0, scale: phase === "done" ? 1 : 0.8 }}
          transition={{ duration: 2, ease: "easeInOut" }}
          className="w-[400px] h-[400px] rounded-full"
          style={{ background: "radial-gradient(circle, hsl(var(--success) / 0.15) 0%, transparent 70%)" }}
        />
      </div>

      <div className="max-w-xl mx-auto flex flex-col items-center gap-10 relative z-10">

        {/* ── Barcode Container ── */}
        <div className="relative p-6 sm:p-8 bg-foreground/[0.03] border border-foreground/[0.06] rounded-2xl backdrop-blur-sm">
          {/* Corner brackets */}
          {["tl","tr","bl","br"].map(pos => (
            <span
              key={pos}
              className={`absolute w-5 h-5 transition-colors duration-500 ${
                phase === "scanning" ? "border-destructive" :
                phase === "done" ? "border-success" : "border-foreground/15"
              } ${
                pos === "tl" ? "top-3 left-3 border-t-2 border-l-2 rounded-tl" :
                pos === "tr" ? "top-3 right-3 border-t-2 border-r-2 rounded-tr" :
                pos === "bl" ? "bottom-3 left-3 border-b-2 border-l-2 rounded-bl" :
                "bottom-3 right-3 border-b-2 border-r-2 rounded-br"
              }`}
            />
          ))}

          {/* Score readout */}
          <motion.div
            animate={{ opacity: phase === "done" ? 1 : 0, y: phase === "done" ? 0 : 8 }}
            transition={{ duration: 0.5 }}
            className="absolute -top-10 left-1/2 -translate-x-1/2 font-mono text-xs tracking-[3px] text-success whitespace-nowrap"
            style={{ textShadow: "0 0 20px hsl(var(--success) / 0.3)" }}
          >
            ETHICS SCORE: 73 / 100
          </motion.div>

          {/* Barcode bars */}
          <div className="relative flex items-end" style={{ width: totalW, height: MAX_H }}>
            {BAR_DATA.map(([w, hFrac], i) => {
              const h = hFrac * MAX_H;
              const isRevealed = revealed[i];
              const grade = GRADE_COLORS[i];
              return (
                <div
                  key={i}
                  className={`rounded-[1px] transition-opacity duration-100 ${
                    isRevealed ? "opacity-100" : "opacity-[0.15]"
                  } ${
                    isRevealed
                      ? grade === "good" ? "bg-success" : grade === "mid" ? "bg-warning" : "bg-destructive"
                      : "bg-foreground/80"
                  }`}
                  style={{ width: w, height: h, marginRight: 2, transition: isRevealed ? "background 0.6s ease, opacity 0.1s" : "opacity 0.1s" }}
                />
              );
            })}

            {/* Scanner laser */}
            {phase === "scanning" && (
              <div
                className="absolute top-[-12px] bottom-[-12px] w-[3px] rounded-sm z-10"
                style={{
                  left: `${scanProgress * 100}%`,
                  background: "hsl(var(--destructive))",
                  boxShadow: `0 0 20px hsl(var(--destructive) / 0.4), 0 0 60px hsl(var(--destructive) / 0.25), 0 0 4px hsl(var(--destructive))`,
                }}
              >
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-[3px] rounded-sm bg-destructive" style={{ boxShadow: "0 0 8px hsl(var(--destructive) / 0.4)" }} />
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-[3px] rounded-sm bg-destructive" style={{ boxShadow: "0 0 8px hsl(var(--destructive) / 0.4)" }} />
              </div>
            )}
          </div>

          {/* Barcode number */}
          <p className={`font-mono text-[13px] tracking-[6px] text-center mt-4 transition-colors duration-500 ${
            phase === "done" ? "text-foreground/70" : "text-foreground/25"
          }`}>
            0 49000 04963 7
          </p>
        </div>

        {/* ── Text block ── */}
        <div className="text-center space-y-5 max-w-md">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 1 }}
            className="font-mono text-[11px] tracking-[6px] uppercase text-success"
          >
            Scan · Reveal · Decide
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 1 }}
            className="font-display font-bold text-[clamp(28px,5vw,48px)] leading-[1.1] tracking-tight text-foreground"
          >
            Know what's behind{" "}
            <em className="not-italic text-success">every barcode</em>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 1 }}
            className="text-base font-light leading-relaxed text-muted-foreground"
          >
            Scan any product. Instantly see the brand's ethics, ownership, and whether they align with your values.
          </motion.p>
        </div>

        {/* ── Search + Scan ── */}
        <motion.form
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.6 }}
          onSubmit={handleSearch}
          className="space-y-3 w-full max-w-md"
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search any brand..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 w-full bg-card border-border/20 text-foreground placeholder:text-muted-foreground focus:border-accent/40 font-mono text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="submit"
              className="flex-1 h-10 bg-elevated-2 hover:bg-elevated-3 text-primary font-mono text-xs uppercase tracking-wider border border-border/20"
              disabled={!searchQuery.trim()}
            >
              <Search className="mr-2 h-3.5 w-3.5" />
              Search
            </Button>
            <Button
              type="button"
              className="flex-1 h-10 gradient-forensic text-background font-mono text-xs uppercase tracking-wider hover:opacity-90"
              onClick={() => navigate("/scan")}
            >
              <ScanLine className="mr-2 h-3.5 w-3.5" />
              Scan Barcode
            </Button>
          </div>
        </motion.form>
      </div>
    </section>
  );
}
