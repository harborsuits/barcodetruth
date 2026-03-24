import { Search, ScanLine } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export function HeroSection() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <section className="w-full py-10 sm:py-16 relative overflow-hidden">
      {/* Subtle scan lines background effect */}
      <div className="absolute inset-0 opacity-[0.03]">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="absolute left-0 right-0 h-px bg-primary"
            style={{ top: `${(i + 1) * 12}%` }}
          />
        ))}
      </div>

      <div className="max-w-xl mx-auto text-center space-y-8 relative z-10">
        {/* System status indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-center gap-2"
        >
          <div className="h-1.5 w-1.5 bg-success animate-pulse-glow" />
          <span className="text-data text-muted-foreground font-mono text-xs uppercase tracking-widest">SYSTEM_ACCESS: GRANTED</span>
        </motion.div>

        {/* Barcode accent */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="flex gap-[2px] justify-center"
        >
          {[3, 1, 4, 1, 3, 1, 4, 2, 1, 3, 4, 1, 2, 3, 1].map((h, i) => (
            <div
              key={i}
              className="w-[2px] bg-primary"
              style={{ height: `${h * 5}px` }}
            />
          ))}
        </motion.div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="space-y-2"
        >
          <h1 className="font-display font-bold text-3xl sm:text-5xl tracking-tight text-foreground">
            Forensic Audit:
          </h1>
          <p className="font-display font-bold text-3xl sm:text-5xl tracking-tight text-primary">
            Global Brands
          </p>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="text-sm leading-relaxed text-muted-foreground max-w-sm mx-auto"
        >
          Ownership chains + verified events from public sources — without telling you what to think.
        </motion.p>

        {/* Search + Scan */}
        <motion.form
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          onSubmit={handleSearch}
          className="space-y-3 max-w-md mx-auto"
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

        {/* Protocol indicator */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.5 }}
          className="text-data text-muted-foreground/50"
        >
          Active Protocols: [EAN-13, UPC, QR_ISO]
        </motion.p>
      </div>
    </section>
  );
}
