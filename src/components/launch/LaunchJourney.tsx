import { ScanLine, Shield, Building2, ArrowRightLeft } from "lucide-react";
import { motion } from "framer-motion";

const stages = [
  {
    icon: ScanLine,
    title: "Scan",
    description: "Point at any barcode",
  },
  {
    icon: Shield,
    title: "Verdict",
    description: "Get an instant rating",
  },
  {
    icon: Building2,
    title: "Ownership",
    description: "See who's behind it",
  },
  {
    icon: ArrowRightLeft,
    title: "Alternative",
    description: "Find something better",
  },
];

export function LaunchJourney() {
  return (
    <section className="py-20 px-4 bg-card/50">
      <div className="max-w-5xl mx-auto space-y-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-3"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Your Journey</h2>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            From scan to smarter choice in seconds
          </p>
        </motion.div>

        {/* Desktop: horizontal with connecting line */}
        <div className="hidden md:block relative">
          {/* Connecting line */}
          <div className="absolute top-10 left-[10%] right-[10%] h-px bg-border" />

          <div className="grid grid-cols-4 gap-8 relative">
            {stages.map((stage, i) => (
              <motion.div
                key={stage.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.12 }}
                className="flex flex-col items-center text-center space-y-3"
              >
                <div className="w-20 h-20 rounded-2xl bg-background border border-border/50 flex items-center justify-center relative z-10">
                  <stage.icon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-bold text-foreground">{stage.title}</h3>
                <p className="text-sm text-muted-foreground">{stage.description}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Mobile: vertical with connecting line */}
        <div className="md:hidden relative pl-10">
          {/* Connecting line */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />

          <div className="space-y-8">
            {stages.map((stage, i) => (
              <motion.div
                key={stage.title}
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="flex items-start gap-4 relative"
              >
                <div className="absolute -left-10 w-10 h-10 rounded-xl bg-background border border-border/50 flex items-center justify-center">
                  <stage.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">{stage.title}</h3>
                  <p className="text-sm text-muted-foreground">{stage.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
