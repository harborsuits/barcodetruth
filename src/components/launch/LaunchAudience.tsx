import { Heart, Baby, ShieldAlert, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

const audiences = [
  {
    icon: Heart,
    title: "Conscious shoppers",
    description: "You already care about what you buy. Now you can verify it in seconds.",
  },
  {
    icon: Baby,
    title: "Parents",
    description: "Making everyday buying decisions for your family — with confidence.",
  },
  {
    icon: ShieldAlert,
    title: "Brand-skeptics",
    description: "Tired of greenwashing and corporate spin? See the real picture.",
  },
  {
    icon: Sparkles,
    title: "Alternative seekers",
    description: "Always looking for better options? We surface them automatically.",
  },
];

export function LaunchAudience() {
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
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Built for You</h2>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            If you've ever wondered what's behind the brands you buy
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-6">
          {audiences.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="flex gap-4 items-start bg-card border border-border/50 rounded-2xl p-6 hover:border-primary/30 transition-colors"
            >
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">{item.title}</h3>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{item.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
