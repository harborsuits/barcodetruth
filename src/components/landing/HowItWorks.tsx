import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Database, ShieldCheck, User } from "lucide-react";

export function HowItWorks() {
  return (
    <section className="py-12 px-4 bg-muted/30">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">How This Works</h2>
          <p className="text-muted-foreground">
            Three simple steps to informed decisions
          </p>
        </div>

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="ingest">
            <AccordionTrigger className="text-left">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-primary" />
                <span className="font-semibold">1. We Ingest</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              We continuously monitor trusted news sources, government filings, and regulatory agencies
              to capture brand-related events across labor, environment, politics, and social impact.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="verify">
            <AccordionTrigger className="text-left">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <span className="font-semibold">2. We Verify</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Events are classified by verification level: <strong>Official</strong> (government sources),
              <strong>Corroborated</strong> (multiple credible sources), or <strong>Unverified</strong> (single source).
              We cite all sources and never make independent claims.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="decide">
            <AccordionTrigger className="text-left">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-primary" />
                <span className="font-semibold">3. You Decide</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Adjust the importance of each category to match your values. Scores update in real-time
              based on your preferences, helping you make decisions aligned with what matters to you.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </section>
  );
}
