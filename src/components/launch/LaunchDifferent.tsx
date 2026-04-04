import { Leaf, DollarSign, ShieldCheck, ArrowRightLeft } from "lucide-react";
import { motion } from "framer-motion";

const cards = [
  {
    icon: Leaf,
    title: "Beyond ingredients",
    description: "We look at the company, not just the label. Ethics, labor, environment — the stuff that matters.",
  },
  {
    icon: DollarSign,
    title: "Follow the money",
    description: "See who really owns the brand. Parent companies, investors, and corporate connections revealed.",
  },
  {
    icon: ShieldCheck,
    title: "Real trust scores",
    description: "Ratings based on verified public data — not sponsored reviews or paid certifications.",
  },
  {
    icon: ArrowRightLeft,
    title: "Better alternatives, instantly",
    description: "Don't just avoid bad brands. Discover better options in the same category, right away.",
  },
];

export function LaunchDifferent() {
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
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
            Why Barcode Truth Is Different
          </h2>
          <p className="text-muted-foreground text-lg max-w-lg mx-auto">
            Not another ingredient scanner. A window into who you're really buying from.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-6">
          {cards.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="bg-card border border-border/50 rounded-2xl p-6 space-y-3 hover:border-primary/30 transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <card.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground">{card.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{card.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
