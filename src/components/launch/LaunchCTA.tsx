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
          Start shopping smarter
        </h2>
        <p className="text-lg text-muted-foreground max-w-md mx-auto">
          Join thousands of people who are making more informed choices — one scan at a time.
        </p>
        <Button asChild size="lg" className="rounded-xl text-base px-10 h-12">
          <Link to="/auth">
            Get Started Free
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </motion.div>
    </section>
  );
}
