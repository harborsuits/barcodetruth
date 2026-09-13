import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const FAQ = [
  {
    q: "Can I keep something for my next shopping trip?",
    a: "Yes. Save a check on a product result and reopen it from Your next shop on the home page. This checklist stays in your browser and can be removed there. It is not a recall-alert subscription or a verified list of recommended products.",
  },
  {
    q: "Where does the data come from?",
    a: "Public regulatory filings (SEC, FDA, EPA, OSHA), federal lobbying disclosures, court records, and reporting from outlets like Reuters, the Guardian, and the NYT. Source coverage varies. Inspect the linked evidence and its date; a missing record does not establish that a company has no issues.",
  },
  {
    q: "Do brands pay to appear or to change their score?",
    a: "No. Barcode Truth is independent. We don't accept payment from brands to add, change, improve, or remove scores. If our funding model ever changes, we'll disclose it on the Why Trust Us page and the rule that monetization never affects scoring will stay in place.",
  },
  {
    q: "What happens if a product isn't in your database?",
    a: "You can submit the product details for review. A submission does not verify its brand or ownership, and we cannot promise when research will be complete.",
  },
  {
    q: "How do I report a wrong score or disputed event?",
    a: "Use the correction or report controls on the relevant record and include a source. Reports need review; submitting one does not establish that a claim is wrong or automatically change a score.",
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
