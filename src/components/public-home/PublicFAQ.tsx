import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const FAQ = [
  {
    q: "Where does the data come from?",
    a: "Public regulatory filings (SEC, FDA, EPA, OSHA), federal lobbying disclosures, court records, and reporting from outlets like Reuters, the Guardian, and the NYT. Every event on a brand profile links to its source.",
  },
  {
    q: "Do brands pay to appear or to change their score?",
    a: "No. Barcode Truth is independent. We don't accept payment from brands to add, change, improve, or remove scores. If our funding model ever changes, we'll disclose it on the Why Trust Us page and the rule that monetization never affects scoring will stay in place.",
  },
  {
    q: "What happens if a product isn't in your database?",
    a: "You can submit it. We immediately start enriching the brand profile and route you to a live result page that updates as data arrives — usually within seconds.",
  },
  {
    q: "How do I report a wrong score or disputed event?",
    a: "Every event and every brand profile has a 'Report an issue' link. Flagged events are reviewed; if disputed, the score recovers immediately while we re-verify.",
  },
  {
    q: "Is my scan history private?",
    a: "Scans aren't tied to your identity unless you create an account. We don't sell user data, ever. Full details on the Why Trust Us page.",
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
