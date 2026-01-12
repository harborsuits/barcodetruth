import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Methodology() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Data & Scoring Methodology</CardTitle>
            <p className="text-sm text-muted-foreground">
              <strong>Last Updated:</strong> October 2025
            </p>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none dark:prose-invert">
            <p>
              BarcodeTruth connects consumer products to public evidence about their parent companies, ownership, and societal impact.
              This page describes how our system gathers, verifies, and presents information.
            </p>

            <h2 className="text-xl font-semibold mt-6 mb-3">1. Core Principles</h2>
            <ol className="list-decimal pl-6 space-y-1">
              <li><strong>Transparency:</strong> all evidence links directly to its original publication source.</li>
              <li><strong>Neutrality:</strong> events are categorized, not editorialized.</li>
              <li><strong>Verification:</strong> credible sources and cross-corroboration are prioritized.</li>
              <li><strong>Community inclusion:</strong> users help shape brand outlook through transparent ratings.</li>
            </ol>

            <h2 className="text-xl font-semibold mt-6 mb-3">2. Evidence Ingestion</h2>
            <p>BarcodeTruth continuously ingests news from multiple public and open-license sources, including:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Official government databases (e.g., OSHA, FDA, SEC filings).</li>
              <li>Established news outlets and verified APIs.</li>
              <li>Academic and NGO publications.</li>
              <li>Public company reports.</li>
            </ul>
            <p>Automated enrichment and deduplication systems identify relevance to each brand or parent company.</p>

            <h2 className="text-xl font-semibold mt-6 mb-3">3. Categorization Framework</h2>
            <p>Each event is tagged under four ethical pillars ("IDEALS"):</p>
            
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border-collapse border border-border">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="border border-border px-4 py-2 text-left font-semibold">Pillar</th>
                    <th className="border border-border px-4 py-2 text-left font-semibold">Example Topics</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-border px-4 py-2"><strong>Labor</strong></td>
                    <td className="border border-border px-4 py-2">workplace safety, fair pay, union activity</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-4 py-2"><strong>Environment</strong></td>
                    <td className="border border-border px-4 py-2">pollution, climate commitments, sustainability</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-4 py-2"><strong>Politics</strong></td>
                    <td className="border border-border px-4 py-2">lobbying, campaign donations, regulatory influence</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-4 py-2"><strong>Social</strong></td>
                    <td className="border border-border px-4 py-2">community impact, discrimination, inclusion</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p>Sub-categories further specify event types (e.g., "supply-chain," "legal," "product safety").</p>

            <h2 className="text-xl font-semibold mt-6 mb-3">4. Verification Levels</h2>
            
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border-collapse border border-border">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="border border-border px-4 py-2 text-left font-semibold">Level</th>
                    <th className="border border-border px-4 py-2 text-left font-semibold">Description</th>
                    <th className="border border-border px-4 py-2 text-left font-semibold">Weight</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-border px-4 py-2"><strong>Official</strong></td>
                    <td className="border border-border px-4 py-2">Direct government or company filing</td>
                    <td className="border border-border px-4 py-2">1.0</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-4 py-2"><strong>Corroborated</strong></td>
                    <td className="border border-border px-4 py-2">Multiple credible sources confirm event</td>
                    <td className="border border-border px-4 py-2">0.75</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-4 py-2"><strong>Independent</strong></td>
                    <td className="border border-border px-4 py-2">Single credible but unverified report</td>
                    <td className="border border-border px-4 py-2">0.5</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-4 py-2"><strong>Unverified / Claim</strong></td>
                    <td className="border border-border px-4 py-2">User or minor-source submission</td>
                    <td className="border border-border px-4 py-2">0.25</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p>Only verified and corroborated events affect brand confidence indicators.</p>

            <h2 className="text-xl font-semibold mt-6 mb-3">5. What We Do and Don't Know</h2>
            <div className="bg-muted/50 rounded-lg p-4 my-4">
              <h4 className="font-medium mb-2">We show:</h4>
              <ul className="list-disc pl-6 space-y-1 mb-4">
                <li>Verified news events from credible sources</li>
                <li>Public ownership filings and SEC disclosures</li>
                <li>Government database records (OSHA, FDA, EPA, FEC)</li>
                <li>Documented corporate actions and legal proceedings</li>
              </ul>
              
              <h4 className="font-medium mb-2">We may not show:</h4>
              <ul className="list-disc pl-6 space-y-1 mb-4">
                <li>Private equity layers and complex investment structures</li>
                <li>Brand licensing arrangements vs. direct ownership</li>
                <li>Internal company practices not publicly reported</li>
                <li>Recent developments not yet indexed by our sources</li>
                <li>Minority investment stakes below disclosure thresholds</li>
              </ul>
              
              <h4 className="font-medium mb-2">We cannot guarantee:</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>Completeness of any brand's profile</li>
                <li>Real-time accuracy of all information</li>
                <li>That absence of events means absence of issues</li>
              </ul>
            </div>
            <p className="text-sm text-muted-foreground italic">
              This is best-effort research, not authoritative truth. Use it as one input in your decision-making.
            </p>

            <h2 className="text-xl font-semibold mt-6 mb-3">6. Community Outlook (Beta)</h2>
            <p>
              The company-level numerical scores are being replaced by <strong>Community Outlook</strong>, which aggregates how users interpret evidence across the same four pillars.
              Participants rate each pillar on a 1–5 scale ("Strongly Negative" → "Strongly Positive").
              Aggregates use Bayesian weighting to balance early data and prevent bias.
            </p>

            <h2 className="text-xl font-semibold mt-6 mb-3">7. Educational Purpose</h2>
            <p>
              BarcodeTruth is an informational tool intended to promote transparency and critical thinking.
              <strong> It should not be interpreted as definitive corporate evaluation, investment advice, or endorsement.</strong>
            </p>
            <p className="mt-2">
              For more on how to use this information responsibly, see our <a href="/responsible-use" className="text-primary hover:underline">Responsible Use Guide</a>.
            </p>

            <h2 className="text-xl font-semibold mt-6 mb-3">8. Corrections & Feedback</h2>
            <p>
              If you believe an event or categorization is inaccurate, contact us at <a href="mailto:corrections@barcodetruth.app" className="text-primary hover:underline">corrections@barcodetruth.app</a>.
              We review verified correction requests and adjust records accordingly.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Brands also have the right to request corrections through the same channels.
            </p>

            <h2 className="text-xl font-semibold mt-6 mb-3">9. Acknowledgments</h2>
            <p>
              Our platform architecture combines open data, community contributions, and AI-assisted categorization to make complex corporate information accessible to the public.
            </p>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              © 2025 BarcodeTruth™ — All rights reserved.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
