import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScanLine, ArrowRight } from "lucide-react";
import { ScannerIdleAnimation } from "@/components/ScannerIdleAnimation";

export function PublicHero() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  return (
    <section className="pt-12 pb-10 sm:pt-16 sm:pb-14">
      <div className="grid lg:grid-cols-[1.15fr_1fr] gap-10 lg:gap-14 items-center">
        {/* Copy column */}
        <div className="text-center lg:text-left space-y-6 max-w-2xl mx-auto lg:mx-0">
          <p className="text-[11px] tracking-[6px] uppercase text-success font-medium">
            Scan · Reveal · Decide
          </p>
          <h1 className="font-display font-extrabold text-[clamp(34px,6vw,60px)] leading-[1.05] tracking-tight text-foreground">
            Know who owns it.{" "}
            <span className="text-success">Find an alternative that fits your values.</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl leading-relaxed">
            Look up a product or brand, explore its ownership and available evidence, and decide what belongs in your basket.
          </p>
          <form role="search" className="space-y-2 text-left" onSubmit={(event) => {
            event.preventDefault();
            if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
          }}>
            <label htmlFor="home-search" className="text-sm font-medium">Search a product, brand, or company</label>
            <div className="flex gap-2">
              <Input id="home-search" type="search" placeholder="Enter a name" value={query} onChange={(event) => setQuery(event.target.value)} className="h-12 min-w-0" maxLength={200} />
              <Button type="submit" className="h-12" disabled={!query.trim()}>Search</Button>
            </div>
          </form>
          <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start pt-2">
            <Button asChild size="lg" className="h-12 px-8 text-sm uppercase tracking-wider gradient-forensic text-background hover:opacity-90">
              <Link to="/scan">
                <ScanLine className="mr-2 h-5 w-5" />
                Scan a barcode
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 px-8 text-sm uppercase tracking-wider border-border/40">
              <Link to="/how-scores-work">
                How scores work
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground/70 pt-1">
            Coverage varies by product. Missing ownership or evidence is not a positive rating.
          </p>
        </div>

        {/* Animation column — phone mockup */}
        <div className="flex justify-center animate-fade-in">
          <div className="relative w-[240px] sm:w-[280px]">
            {/* Phone bezel */}
            <div className="rounded-[2.5rem] border-[3px] border-border/30 bg-card p-2 shadow-2xl shadow-primary/10">
              {/* Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-background rounded-b-2xl z-10" />
              {/* Screen */}
              <div className="rounded-[2rem] overflow-hidden bg-background aspect-[9/19]">
                <ScannerIdleAnimation />
              </div>
            </div>
            {/* Glow */}
            <div className="absolute -inset-8 bg-primary/8 rounded-full blur-3xl -z-10" />
          </div>
        </div>
      </div>
    </section>
  );
}
