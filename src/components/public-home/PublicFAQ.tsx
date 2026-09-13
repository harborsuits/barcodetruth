import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const FAQ = [
  {
    q: "Can I keep something for my next shopping trip?",
    a: "Yes. Choose Save for later on a product result. Reopen it from Saved for later on the home page. Your saved products stay in this browser and can be removed there. Saving does not subscribe you to recall alerts.",
  },
  {
    q: "Where does the data come from?",
    a: "Product information can include label data from Open Food Facts. Company information links to public filings, company disclosures and reporting. Check the source and date beside each record. Coverage varies, and missing information does not mean a product or company has no issues.",
  },
  {
    q: "Does payment affect what you show me?",
    a: "Current listings are unpaid. Any future sponsored placement must be labeled Ad. Payment cannot change the evidence or make a product qualify as a match for your chosen question.",
  },
  {
    q: "What happens if a product isn't in your database?",
    a: "You can submit the product details for review. A submission does not verify its brand or ownership, and we cannot promise when research will be complete.",
  },
  {
    q: "How do I report incorrect information?",
    a: "Use the correction or report controls where available on a record and include a source. Reports need review before information changes.",
  },
  {
    q: "Is my scan history private?",
    a: "Scanning currently requires an account and can save activity to your account. Read the Privacy page before signing up.",
  },
];

export function PublicFAQ() {
  return (
    <section className="py-10">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <p className="text-xs uppercase tracking-[3px] text-muted-foreground font-medium mb-2">FAQ</p>
          <h2 className="font-display font-bold text-2xl sm:text-3xl text-foreground">
            Straight answers.
          </h2>
        </div>
        <Accordion type="single" collapsible className="w-full">
          {FAQ.map((item, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-left text-sm font-medium">{item.q}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
