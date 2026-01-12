import { Search, ScanLine } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LampContainer } from "@/components/ui/lamp";
import { FallingLogos } from "./FallingLogos";

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
    <section className="w-full py-6 sm:py-10 relative overflow-hidden">
      {/* Falling logos on both sides - fills edge to hero dynamically */}
      <FallingLogos side="left" className="hidden md:block" />
      <FallingLogos side="right" className="hidden md:block" />
      
      <div className="max-w-5xl mx-auto px-4 relative z-10">
        <LampContainer className="min-h-[420px]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.3,
              duration: 0.8,
              ease: "easeOut",
            }}
            className="max-w-xl mx-auto text-center space-y-8 px-4"
          >
            {/* Barcode accent */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 0.25 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="flex gap-0.5 justify-center"
            >
              {[2, 1, 3, 1, 2, 1, 3, 2, 1, 2, 3, 1].map((h, i) => (
                <div
                  key={i}
                  className="w-0.5 bg-primary rounded-full"
                  style={{ height: `${h * 4}px` }}
                />
              ))}
            </motion.div>

            {/* Headline with hierarchy */}
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.5,
                duration: 0.6,
                ease: "easeOut",
              }}
              className="text-center"
            >
              <span className="block text-2xl sm:text-3xl font-medium text-white/90">
                Scan a barcode.
              </span>
              <motion.span
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.58,
                  duration: 0.5,
                  ease: "easeOut",
                }}
                className="block text-4xl sm:text-5xl font-bold text-primary mt-1"
              >
                See who owns it.
              </motion.span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{
                delay: 0.65,
                duration: 0.6,
                ease: "easeOut",
              }}
              className="text-base leading-relaxed text-slate-400/80 max-w-sm mx-auto"
            >
              Ownership chains + verified events from public sources — without telling you what to think.
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{
                delay: 0.7,
                duration: 0.5,
                ease: "easeOut",
              }}
              className="text-xs text-slate-500/70"
            >
              No results? Add it once and it works next time.
            </motion.p>

            <motion.form
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.75,
                duration: 0.6,
                ease: "easeOut",
              }}
              onSubmit={handleSearch}
              className="space-y-3 max-w-md mx-auto"
            >
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400/70" />
                <Input
                  type="text"
                  placeholder="Search for any brand..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-12 w-full bg-slate-800/50 text-white placeholder:text-slate-400/70 border border-white/10 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 shadow-inner shadow-primary/5 rounded-lg"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  className="flex-1 h-11 rounded-lg bg-primary/20 hover:bg-primary/30 text-white font-medium border border-primary/30"
                  disabled={!searchQuery.trim()}
                >
                  <Search className="mr-2 h-4 w-4" />
                  Search
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1 h-11 rounded-lg bg-white/5 hover:bg-white/10 text-white font-medium border border-white/10"
                  onClick={() => navigate("/scan")}
                >
                  <ScanLine className="mr-2 h-4 w-4" />
                  Scan Barcode
                </Button>
              </div>
            </motion.form>
          </motion.div>
        </LampContainer>
      </div>
    </section>
  );
}
