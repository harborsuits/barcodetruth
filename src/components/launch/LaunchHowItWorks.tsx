import { ScanLine, Search, ThumbsUp } from "lucide-react";
import { motion } from "framer-motion";

const steps = [
  {
    icon: ScanLine,
    step: "1",
    title: "Scan",
    description: "Point your camera at any barcode or search a brand by name.",
  },
  {
    icon: Search,
    step: "2",
    title: "We check",
    description: "We cross-reference public records, news, and regulatory data in seconds.",
  },
  {
    icon: ThumbsUp,
    step: "3",
    title: "You decide",
    description: "See a clear rating, top concerns, and better alternatives — instantly.",
  },
];

export function LaunchHowItWorks() {
  return (
    <section id="how-it-works" className="py-20 px-4">
      <div className="max-w-5xl mx-auto space-y-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-3"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">How It Works</h2>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Three steps to know what you're buying
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 md:gap-8">
          {steps.map((step, i) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              className="bg-card border border-border/50 rounded-2xl p-8 text-center space-y-4 hover:border-primary/30 transition-colors"
            >
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10 text-primary mx-auto">
                <step.icon className="h-7 w-7" />
              </div>
              <div className="text-sm text-primary font-semibold uppercase tracking-wide">
                Step {step.step}
              </div>
              <h3 className="text-xl font-bold text-foreground">{step.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
