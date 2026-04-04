import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "How does Barcode Truth work?",
    answer: "Scan any product barcode with your phone camera. We instantly identify the brand, cross-reference public records, news, and regulatory data, then give you a clear rating with the top concerns and better alternatives.",
  },
  {
    question: "What kinds of products can I scan?",
    answer: "Anything with a barcode — snacks, personal care, household products, hygiene items, beverages, and more. If it has a barcode, we can look it up.",
  },
  {
    question: "Does it only rate food?",
    answer: "No. Barcode Truth rates the brand behind the product, not just the product itself. That means we cover food, personal care, cleaning products, and any consumer goods category.",
  },
  {
    question: "How do you decide brand scores?",
    answer: "Scores are based on verified public data — news reports, regulatory filings, labor records, environmental data, and more. No paid certifications, no sponsored placements.",
  },
  {
    question: "Can I discover better alternatives?",
    answer: "Yes. Every scan shows you higher-rated alternatives in the same category so you can make a better choice right in the store.",
  },
  {
    question: "Is the app live yet?",
    answer: "Yes! Barcode Truth is live and growing. Sign up to start scanning and join our community of conscious shoppers.",
  },
];

export function LaunchFAQ() {
  return (
    <section className="py-20 px-4">
      <div className="max-w-2xl mx-auto space-y-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-3"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Questions?</h2>
          <p className="text-muted-foreground text-lg">We've got answers</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Accordion type="single" collapsible className="space-y-2">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="border border-border/50 rounded-xl px-5 data-[state=open]:bg-card/80"
              >
                <AccordionTrigger className="text-left text-foreground font-medium hover:no-underline py-4">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed pb-4">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}
