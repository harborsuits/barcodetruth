import { Button } from "@/components/ui/button";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ScannerIdleAnimation } from "@/components/ScannerIdleAnimation";

export function LaunchHero() {
  const scrollToHowItWorks = () => {
    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center px-4 pt-20 pb-16 overflow-hidden">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />

      <div className="max-w-5xl mx-auto w-full grid md:grid-cols-2 gap-12 md:gap-16 items-center">
        {/* Copy side */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="space-y-6 text-center md:text-left"
        >
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight text-foreground">
            Shop with your values,{" "}
            <span className="text-primary">not just your eyes</span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-lg mx-auto md:mx-0 leading-relaxed">
            Scan any product. Instantly see who owns it, the biggest red flags, and better alternatives.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
            <Button asChild size="lg" className="rounded-xl text-base px-8 h-12">
              <Link to="/auth">
                Try Barcode Truth
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="rounded-xl text-base px-8 h-12 border-border/50"
              onClick={scrollToHowItWorks}
            >
              See How It Works
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </div>

          <p className="text-sm text-muted-foreground/60">
            Join 1,000+ conscious shoppers
          </p>
        </motion.div>

        {/* Phone mockup */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
          className="flex justify-center"
        >
          <div className="relative w-[280px] sm:w-[300px]">
            {/* Phone bezel */}
            <div className="rounded-[2.5rem] border-[3px] border-border/30 bg-card p-2 shadow-2xl shadow-primary/5">
              {/* Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-background rounded-b-2xl z-10" />
              {/* Screen */}
              <div className="rounded-[2rem] overflow-hidden bg-background aspect-[9/19]">
                <ScannerIdleAnimation />
              </div>
            </div>
            {/* Glow effect */}
            <div className="absolute -inset-8 bg-primary/8 rounded-full blur-3xl -z-10" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
