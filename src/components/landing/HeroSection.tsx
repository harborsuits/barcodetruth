import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ScanLine } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
  };

  return (
    <section className="w-full">
      <div className="max-w-md mx-auto flex flex-col items-center gap-6">
        {/* Tagline */}
        <div className="text-center space-y-2">
          <p className="text-[11px] tracking-[6px] uppercase text-success font-medium">
            Scan · Reveal · Decide
          </p>
          <h1 className="font-display font-bold text-[clamp(28px,5vw,48px)] leading-[1.1] tracking-tight text-foreground">
            Know what's behind{" "}
            <em className="not-italic text-success">every barcode</em>
          </h1>
          <p className="text-base font-light leading-relaxed text-muted-foreground">
            Scan any product. Instantly see who owns it, the biggest red flags, and better alternatives.
          </p>
        </div>

        {/* CTAs */}
        <div className="space-y-3 w-full">
          <Button
            className="w-full h-14 gradient-forensic text-background font-semibold text-sm uppercase tracking-wider hover:opacity-90"
            onClick={() => navigate("/scan")}
          >
            <ScanLine className="mr-2 h-5 w-5" />
            Scan a Product
          </Button>

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
        </div>
      </div>
    </section>
  );
}
