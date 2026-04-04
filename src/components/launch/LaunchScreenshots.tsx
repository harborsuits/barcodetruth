import { motion } from "framer-motion";
import { ScanLine, Shield, FileText, Building2, ArrowRightLeft, Layers } from "lucide-react";

const screenshots = [
  {
    title: "Scan any product",
    caption: "Point your camera at a barcode — results appear instantly.",
    icon: ScanLine,
    gradient: "from-primary/20 to-primary/5",
  },
  {
    title: "Instant verdict",
    caption: "Good, Mixed, or Avoid — know at a glance.",
    icon: Shield,
    gradient: "from-emerald-500/20 to-emerald-500/5",
  },
  {
    title: "See why it scored that way",
    caption: "Top concerns based on real evidence, not opinions.",
    icon: FileText,
    gradient: "from-amber-500/20 to-amber-500/5",
  },
  {
    title: "Who really owns it",
    caption: "Follow the money to the parent company.",
    icon: Building2,
    gradient: "from-violet-500/20 to-violet-500/5",
  },
  {
    title: "Better alternatives",
    caption: "Discover higher-rated brands in the same category.",
    icon: ArrowRightLeft,
    gradient: "from-sky-500/20 to-sky-500/5",
  },
  {
    title: "Deeper evidence",
    caption: "Dive into the full breakdown when you want the details.",
    icon: Layers,
    gradient: "from-rose-500/20 to-rose-500/5",
  },
];

export function LaunchScreenshots() {
  return (
    <section className="py-20 px-4">
      <div className="max-w-5xl mx-auto space-y-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-3"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">See It in Action</h2>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Everything you need to make smarter purchasing decisions
          </p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {screenshots.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="group bg-card border border-border/50 rounded-2xl overflow-hidden hover:border-primary/30 transition-colors"
            >
              {/* Screenshot placeholder */}
              <div className={`aspect-[4/3] bg-gradient-to-br ${item.gradient} flex items-center justify-center`}>
                <item.icon className="h-10 w-10 text-foreground/30 group-hover:text-foreground/50 transition-colors" />
              </div>
              {/* Caption */}
              <div className="p-4 space-y-1">
                <h3 className="font-semibold text-sm text-foreground">{item.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.caption}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
