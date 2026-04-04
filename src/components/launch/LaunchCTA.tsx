import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export function LaunchCTA() {
  return (
    <section className="py-24 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
        className="max-w-2xl mx-auto text-center space-y-6"
      >
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
          Stop guessing. Start scanning.
        </h2>
        <p className="text-lg text-muted-foreground max-w-md mx-auto">
          See who really owns the brands you buy — and find better alternatives in seconds.
        </p>
        <Button asChild size="lg" className="rounded-xl text-base px-10 h-12">
          <Link to="/auth">
            Get Started Free
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground/50">
          Free to use · Works on any phone · No app download needed
        </p>
      </motion.div>
    </section>
  );
}
