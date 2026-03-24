import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ScanLine } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ScannerIdleAnimation } from "@/components/ScannerIdleAnimation";

export function HeroSection() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
  };

  return (
    <section className="w-full py-12 sm:py-20 relative overflow-hidden">
      <div className="max-w-xl mx-auto flex flex-col items-center gap-10 relative z-10">

        {/* ── Canvas Scanner Animation ── */}
        <div className="relative w-full max-w-[390px] aspect-[390/480] rounded-2xl overflow-hidden bg-[#151d2b] border border-foreground/[0.06]">
          <ScannerIdleAnimation />
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
