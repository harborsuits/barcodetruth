import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, DollarSign, Lock, FileSearch, Flag, Database } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function WhyTrustUs() {
  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Why trust us</h1>
          <p className="text-muted-foreground mt-2">Last updated: April 2026</p>
        </div>

        <Card className="bg-success/5 border-success/30">
          <CardContent className="pt-6">
            <p className="text-base leading-relaxed">
              Barcode Truth interprets brands. That's a position of trust — and we earn it by being inspectable, not by asking you to take our word for it. Here's exactly how this works today.
            </p>
          </CardContent>
        </Card>

        {/* Funding */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Funding
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p className="font-medium text-foreground">
              Today: Barcode Truth is independent and self-funded. We do not accept payment from brands to add, remove, raise, or lower a score.
            </p>
            <p className="text-muted-foreground">
              We don't show ads. We don't sell scores. We don't take placement fees. No brand has ever paid to appear, be hidden, or be promoted as an "alternative."
            </p>
            <div className="border-l-2 border-primary/40 pl-4 py-2 bg-primary/5 rounded-r">
              <p className="font-medium text-foreground mb-1">If our funding model ever changes</p>
              <p className="text-muted-foreground">
                We're a small, early-stage product. Future monetization (subscriptions, affiliate links, an API tier, or a non-profit model) is on the table. If anything changes, we'll disclose it on this page first — and the rule that <strong className="text-foreground">monetization never affects scoring</strong> stays in place permanently. That firewall is the product.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Privacy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Privacy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-relaxed">
            <p>You can scan products without an account. We don't link scans to a real-world identity unless you sign up.</p>
            <p>We don't sell user data. We don't share scan history with brands or advertisers.</p>
            <p>If you create an account, your saved lists and preferences are visible only to you. Full details: <Link to="/privacy" className="text-primary underline">Privacy Policy</Link>.</p>
          </CardContent>
        </Card>

        {/* Sources */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Where the data comes from
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-relaxed">
            <p>Every score is built from public, citable sources:</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li><strong className="text-foreground">Regulatory:</strong> SEC filings, FDA recalls, EPA enforcement actions, OSHA violations, federal lobbying disclosures (LDA), FEC donations.</li>
              <li><strong className="text-foreground">Reporting:</strong> Reuters, the Guardian, the New York Times, AP, and other major outlets via licensed feeds.</li>
              <li><strong className="text-foreground">Court records:</strong> federal and state lawsuits, settlements, and consent decrees.</li>
              <li><strong className="text-foreground">Ownership:</strong> SEC ownership filings, Wikidata, LEI registries.</li>
            </ul>
            <p className="pt-2">Every event on a brand profile links to its source. If a claim isn't sourced, it doesn't ship.</p>
          </CardContent>
        </Card>

        {/* Confidence */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSearch className="h-5 w-5 text-primary" />
              When we don't know enough
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-relaxed">
            <p>Not every brand has the same volume of public evidence. We surface that honestly:</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li><strong className="text-foreground">Strong data:</strong> 20+ verified events. High confidence in the score.</li>
              <li><strong className="text-foreground">Moderate data:</strong> 5–19 events. Score is directional.</li>
              <li><strong className="text-foreground">Limited data:</strong> &lt; 5 events. Treat as preliminary.</li>
              <li><strong className="text-foreground">Score in progress:</strong> brand was just submitted; we're enriching now.</li>
            </ul>
          </CardContent>
        </Card>

        {/* Corrections */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-primary" />
              Corrections & disputes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-relaxed">
            <p>We will get things wrong. The fix loop is designed for that:</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Every event has a <strong className="text-foreground">Report an issue</strong> link.</li>
              <li>Disputed events are immediately neutralized in scoring while we re-verify — so a single bad source can't tank a brand.</li>
              <li>Brands can submit verified corrections through the same channel; verified updates are processed within days.</li>
              <li>We log corrections publicly on the brand profile so you can see what changed and why.</li>
            </ul>
          </CardContent>
        </Card>

        {/* Independence */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-success" />
              The independence rule
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed">
            <p>
              No brand can buy a better score, demote a competitor, hide an event, or get added as an "alternative." Not now, not after we monetize, not ever. That rule is the only thing that makes a verdict mean anything.
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <Button asChild className="flex-1">
            <Link to="/how-scores-work">How scores actually work →</Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link to="/scan">Try a real scan</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
