import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Heart, Shield, Scale, Users, AlertTriangle } from "lucide-react";

export default function ResponsibleUse() {
  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Responsible Use Guide</CardTitle>
            <p className="text-sm text-muted-foreground">
              How to use BarcodeTruth thoughtfully and ethically
            </p>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none dark:prose-invert space-y-8">
            
            <Alert className="border-primary/30 bg-primary/5">
              <Heart className="h-4 w-4 text-primary" />
              <AlertDescription className="text-foreground">
                <strong>Our core principle:</strong> Information is power — interpretation is yours. 
                We provide data; you decide what matters to you.
              </AlertDescription>
            </Alert>

            <section>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Scale className="h-5 w-5 text-primary" />
                What This Information Is
              </h2>
              <ul className="list-disc pl-6 space-y-2 mt-3">
                <li>
                  <strong>Aggregated public data</strong> — We collect information from news outlets, 
                  government databases, and public filings. We don't generate our own claims.
                </li>
                <li>
                  <strong>Best-effort research</strong> — This is not authoritative truth. Data may be 
                  incomplete, out of date, or missing context.
                </li>
                <li>
                  <strong>A starting point</strong> — Use this as one input in your decision-making, 
                  not the only source.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                What This Information Is NOT
              </h2>
              <ul className="list-disc pl-6 space-y-2 mt-3">
                <li>
                  <strong>Not investment advice</strong> — Don't make financial decisions based solely 
                  on this data.
                </li>
                <li>
                  <strong>Not legal advice</strong> — If you have legal concerns, consult a professional.
                </li>
                <li>
                  <strong>Not a complete picture</strong> — We may not know about private actions, 
                  internal changes, or recent developments.
                </li>
                <li>
                  <strong>Not an endorsement or condemnation</strong> — We categorize events; 
                  we don't editorialize.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                How to Interpret Results
              </h2>
              
              <h3 className="text-lg font-medium mt-4">Value Match Scores</h3>
              <p>
                When you set your values in settings, we calculate how well a brand's public record 
                aligns with what you care about. Different people will see different scores for the 
                same brand — that's intentional.
              </p>
              
              <h3 className="text-lg font-medium mt-4">Empty Results</h3>
              <p>
                "No data found" doesn't mean "nothing to hide." It means we haven't indexed this 
                brand yet, or public information is limited. Private companies especially may have 
                sparse data.
              </p>
              
              <h3 className="text-lg font-medium mt-4">Ownership Chains</h3>
              <p>
                Corporate ownership is complex. We show what's publicly documented, but private equity 
                layers, licensing arrangements, and minority stakes may not appear.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                What NOT To Do
              </h2>
              <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 mt-3">
                <ul className="list-disc pl-6 space-y-2 text-destructive-foreground">
                  <li>
                    <strong>Don't harass individuals</strong> — Key people listed may be executives, 
                    but they're also humans. Don't contact them directly about what you find here.
                  </li>
                  <li>
                    <strong>Don't organize pile-ons</strong> — If you disagree with a company's practices, 
                    constructive engagement is more effective than mob action.
                  </li>
                  <li>
                    <strong>Don't screenshot out of context</strong> — A single data point without context 
                    can be misleading. Always link to the full profile.
                  </li>
                  <li>
                    <strong>Don't assume completeness</strong> — Absence of negative events doesn't mean 
                    a company is perfect; it may mean limited public reporting.
                  </li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold">Corrections and Feedback</h2>
              <p>
                If you believe information is inaccurate, incomplete, or unfair:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-3">
                <li>
                  Use the <strong>"Report an issue"</strong> button on any brand profile
                </li>
                <li>
                  Email us at <a href="mailto:corrections@barcodetruth.app" className="text-primary hover:underline">
                    corrections@barcodetruth.app
                  </a>
                </li>
                <li>
                  We review all correction requests and update records accordingly
                </li>
              </ul>
              <p className="mt-3 text-muted-foreground italic">
                Brands also have the right to request corrections through the same channels.
              </p>
            </section>

            <section className="border-t pt-6">
              <h2 className="text-xl font-semibold">Our Commitment</h2>
              <p>
                We're building a tool for informed decision-making, not a weapon for outrage. 
                We believe transparency helps everyone — consumers, companies, and society.
              </p>
              <p className="mt-3">
                Thank you for using BarcodeTruth responsibly.
              </p>
            </section>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              © 2025 BarcodeTruth™ — All rights reserved.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
