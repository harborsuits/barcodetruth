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
    <section className="w-full pt-0 pb-12 sm:pb-20 relative overflow-hidden">
      <div className="max-w-xl mx-auto flex flex-col items-center gap-10 relative z-10">

        {/* Scanner Animation */}
        <div className="relative w-full max-w-[390px] aspect-[390/480] rounded-2xl overflow-hidden bg-[#151d2b] border border-foreground/[0.06]">
          <ScannerIdleAnimation />
        </div>

        {/* Text block */}
        <div className="text-center space-y-5 max-w-md">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 1 }}
            className="text-[11px] tracking-[6px] uppercase text-success font-medium"
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
            Scan any product. Instantly see who owns it, the biggest red flags, and better alternatives.
          </motion.p>
        </div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.6 }}
          className="space-y-3 w-full max-w-md"
        >
          <Button
            className="w-full h-12 gradient-forensic text-background font-semibold text-sm uppercase tracking-wider hover:opacity-90"
            onClick={() => navigate("/scan")}
          >
            <ScanLine className="mr-2 h-4 w-4" />
            Scan a Product
          </Button>

          {/* Search bar — secondary */}
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Or search any brand..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 w-full bg-card border-border/20 text-foreground placeholder:text-muted-foreground focus:border-accent/40 text-sm"
            />
          </form>
        </motion.div>
      </div>
    </section>
  );
}
