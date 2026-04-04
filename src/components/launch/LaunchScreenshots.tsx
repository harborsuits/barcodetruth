import { motion } from "framer-motion";
import screenshotScan from "@/assets/launch/screenshot-scan.jpg";
import screenshotVerdict from "@/assets/launch/screenshot-verdict.jpg";
import screenshotWhy from "@/assets/launch/screenshot-why.jpg";
import screenshotOwnership from "@/assets/launch/screenshot-ownership.jpg";
import screenshotAlternatives from "@/assets/launch/screenshot-alternatives.jpg";
import screenshotEvidence from "@/assets/launch/screenshot-evidence.jpg";

const screenshots = [
  {
    title: "Scan any product",
    caption: "Point your camera at a barcode — results appear instantly.",
    image: screenshotScan,
  },
  {
    title: "Instant verdict",
    caption: "Good, Mixed, or Avoid — know at a glance before you buy.",
    image: screenshotVerdict,
  },
  {
    title: "See why it scored that way",
    caption: "Top concerns backed by real evidence, not opinions.",
    image: screenshotWhy,
  },
  {
    title: "Who really owns it",
    caption: "Follow the money to the parent company behind the label.",
    image: screenshotOwnership,
  },
  {
    title: "Better alternatives",
    caption: "Discover higher-rated brands in the same category, instantly.",
    image: screenshotAlternatives,
  },
  {
    title: "Deeper evidence",
    caption: "Dive into the full breakdown when you want the details.",
    image: screenshotEvidence,
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
              {/* Screenshot */}
              <div className="aspect-[4/3] overflow-hidden bg-muted">
                <img
                  src={item.image}
                  alt={item.title}
                  loading="lazy"
                  width={640}
                  height={960}
                  className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                />
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
