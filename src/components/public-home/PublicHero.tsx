import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScanLine, ArrowRight } from "lucide-react";

export function PublicHero() {
  return (
    <section className="pt-12 pb-10 sm:pt-16 sm:pb-14">
      <div className="max-w-3xl mx-auto text-center space-y-6">
        <p className="text-[11px] tracking-[6px] uppercase text-success font-medium">
          Scan · Reveal · Decide
        </p>
        <h1 className="font-display font-extrabold text-[clamp(34px,6vw,60px)] leading-[1.05] tracking-tight text-foreground">
          Scan a barcode.{" "}
          <span className="text-success">See who you fund.</span>
        </h1>
        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Barcode Truth shows why a product scores the way it does and what better-aligned alternatives exist — fast enough to use while you shop.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button asChild size="lg" className="h-12 px-8 text-sm uppercase tracking-wider gradient-forensic text-background hover:opacity-90">
            <Link to="/scan">
              <ScanLine className="mr-2 h-5 w-5" />
              See a real scan
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
          Independent · No brand payments · No ads
        </p>
      </div>
    </section>
  );
}
