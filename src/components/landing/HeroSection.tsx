import { Search, ScanLine } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LampContainer } from "@/components/ui/lamp";

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
    <section className="-mx-4 sm:-mx-6">
      <LampContainer className="min-h-[420px] pt-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{
            delay: 0.5,
            duration: 0.8,
            ease: "easeOut",
          }}
          className="max-w-2xl mx-auto text-center space-y-6 px-4"
        >
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.6,
              duration: 0.6,
              ease: "easeOut",
            }}
            className="text-3xl sm:text-4xl font-bold bg-gradient-to-b from-foreground to-muted-foreground bg-clip-text text-transparent"
          >
            Discover Who Really
            <br />
            <span className="text-primary">Owns What You Buy</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{
              delay: 0.7,
              duration: 0.6,
              ease: "easeOut",
            }}
            className="text-sm text-muted-foreground max-w-md mx-auto"
          >
            See the people, power, and practices behind the brands — without being told what to think.
          </motion.p>

          <motion.form
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.8,
              duration: 0.6,
              ease: "easeOut",
            }}
            onSubmit={handleSearch}
            className="space-y-3 max-w-md mx-auto"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search for any brand..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 text-base bg-card/80 backdrop-blur-sm border-primary/20 focus:border-primary"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                className="flex-1 h-11"
                disabled={!searchQuery.trim()}
              >
                <Search className="mr-2 h-4 w-4" />
                Search
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-11 border-primary/30 hover:bg-primary/10"
                onClick={() => navigate("/scan")}
              >
                <ScanLine className="mr-2 h-4 w-4" />
                Scan Barcode
              </Button>
            </div>
          </motion.form>
        </motion.div>
      </LampContainer>
    </section>
  );
}
