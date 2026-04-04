import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DECAY_TABLE = [
  { range: "0–30 days", weight: "1.0×", meaning: "Full weight — current behavior" },
  { range: "31–90 days", weight: "0.7×", meaning: "Recent but fading" },
  { range: "91–365 days", weight: "0.4×", meaning: "Relevant context" },
  { range: "1–2 years", weight: "0.2×", meaning: "Background signal" },
  { range: "2+ years", weight: "0.1×", meaning: "Historical context only" },
];

const DIMENSIONS = [
  { name: "Labor", desc: "Worker safety, wages, benefits, union activity, executive pay gaps, supply chain labor" },
  { name: "Environment", desc: "Pollution, emissions, deforestation, water usage, climate commitments, environmental fines" },
  { name: "Social", desc: "Community impact, discrimination, product safety, recalls, data privacy" },
  { name: "Politics", desc: "Lobbying, campaign donations, regulatory influence, political speech" },
];

export default function Methodology() {
  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">How Scoring Works</h1>
          <p className="text-muted-foreground mt-2">Last updated: April 2026</p>
        </div>

        <Card>
          <CardContent className="pt-6 prose prose-sm max-w-none dark:prose-invert">
            <p className="text-base leading-relaxed">
              Barcode Truth scores brands based on <strong>verified public evidence</strong> about how
              they treat workers, communities, and the environment. Every score is backed by specific,
              cited events that you can inspect.
            </p>

            <p className="mt-4 px-4 py-3 bg-primary/5 border border-primary/20 rounded-lg font-medium text-sm">
              We do not accept payment from brands to change, improve, or remove their scores.
            </p>
          </CardContent>
        </Card>

        {/* 1. Two-stage filtering */}
        <Card>
          <CardHeader><CardTitle>1. What gets in (and what doesn't)</CardTitle></CardHeader>
          <CardContent className="prose prose-sm max-w-none dark:prose-invert">
            <p>Every news article goes through a two-stage filter before it can affect a score:</p>
            <h4 className="font-semibold mt-4">Stage 1: Fast blocklist (no AI cost)</h4>
            <p>
              We immediately reject articles about pure financial metrics — earnings per share,
              stock price movements, analyst upgrades, revenue guidance, valuations, and IPOs.
            </p>
            <p>
              <strong>Exception:</strong> If the same article also mentions workers, wages, layoffs,
              or environmental impact, we keep it. That's how "CEO earns 400× median worker salary"
              passes while "Q3 earnings beat estimates" gets killed.
            </p>
            <h4 className="font-semibold mt-4">Stage 2: AI classifier</h4>
            <p>
              Every article that passes Stage 1 is evaluated by an AI classifier that asks one question:
              <em> "Does this reveal how the company treats its workers, suppliers, communities,
              or environment — including through financial decisions that directly affect them?"</em>
            </p>
            <p>
              The classifier assigns an impact score (−10 to +10), a dimension (labor / environment /
              social / politics), and a one-sentence reasoning that we store and show to you.
            </p>
          </CardContent>
        </Card>

        {/* 2. Dimensions */}
        <Card>
          <CardHeader><CardTitle>2. Four dimensions of impact</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {DIMENSIONS.map(d => (
                <div key={d.name} className="flex gap-3">
                  <span className="font-semibold text-sm w-24 shrink-0">{d.name}</span>
                  <span className="text-sm text-muted-foreground">{d.desc}</span>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              The overall score is a weighted average of dimensions, weighted by how many events
              affect each one. A brand with 20 labor events and 2 environment events will have
              its score tilted toward labor.
            </p>
          </CardContent>
        </Card>

        {/* 3. Time decay */}
        <Card>
          <CardHeader><CardTitle>3. Recency weighting</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Recent behavior matters more than ancient history. Every event's impact is multiplied
              by a decay factor based on age:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Event age</th>
                    <th className="text-left py-2 font-medium">Weight</th>
                    <th className="text-left py-2 font-medium">Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  {DECAY_TABLE.map(row => (
                    <tr key={row.range} className="border-b last:border-0">
                      <td className="py-2">{row.range}</td>
                      <td className="py-2 font-mono">{row.weight}</td>
                      <td className="py-2 text-muted-foreground">{row.meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* 4. Deduplication */}
        <Card>
          <CardHeader><CardTitle>4. Deduplication</CardTitle></CardHeader>
          <CardContent className="prose prose-sm max-w-none dark:prose-invert">
            <p>
              When the same story is covered by multiple outlets (e.g., Reuters and AP both report
              a lawsuit), we group them and count the event <strong>once</strong>. The version from
              the most credible source is kept as canonical, with a small credibility boost for
              multi-outlet coverage.
            </p>
            <p>
              This prevents a viral story from artificially inflating or deflating a score just
              because many outlets covered it.
            </p>
          </CardContent>
        </Card>

        {/* 5. Per-brand cap */}
        <Card>
          <CardHeader><CardTitle>5. Volume bias protection</CardTitle></CardHeader>
          <CardContent className="prose prose-sm max-w-none dark:prose-invert">
            <p>
              Large brands like Walmart generate far more news coverage than small brands. To prevent
              this from distorting comparisons, we cap scoring at <strong>50 events per brand per
              90-day window</strong>. Only the 50 most recent, most credible events are used.
            </p>
          </CardContent>
        </Card>

        {/* 6. Minimum threshold */}
        <Card>
          <CardHeader><CardTitle>6. When we show a score</CardTitle></CardHeader>
          <CardContent className="prose prose-sm max-w-none dark:prose-invert">
            <p>
              A brand needs at least <strong>3 scored events</strong> before we display a numerical
              score. Until then, we show "Score coming soon" to avoid misleading conclusions from
              insufficient data.
            </p>
            <p>
              Each score also shows a confidence badge (Limited data / Some data / Good data /
              Strong data) so you know how much evidence backs it.
            </p>
          </CardContent>
        </Card>

        {/* 7. Disputes */}
        <Card>
          <CardHeader><CardTitle>7. Dispute process</CardTitle></CardHeader>
          <CardContent className="prose prose-sm max-w-none dark:prose-invert">
            <p>
              Every event has a "Dispute" button. If you believe an event is incorrectly attributed,
              factually wrong, or mis-scored, you can flag it. When disputed:
            </p>
            <ol className="list-decimal pl-6 space-y-1">
              <li>The event is immediately removed from score calculation</li>
              <li>Our team reviews the original source</li>
              <li>We either reinstate the event (with correction) or permanently exclude it</li>
            </ol>
            <p>
              Brands are welcome to dispute events through the same process. Contact{" "}
              <a href="mailto:corrections@barcodetruth.app" className="text-primary hover:underline">corrections@barcodetruth.app</a>{" "}
              for bulk corrections.
            </p>
          </CardContent>
        </Card>

        {/* 8. Classifier prompt */}
        <Card>
          <CardHeader><CardTitle>8. Classifier prompt (published)</CardTitle></CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-lg text-xs font-mono leading-relaxed whitespace-pre-wrap">
{`You are evaluating news events for an ethical consumer app.

Read this article title and description. Answer only:
does this reveal how [brand] treats its workers, suppliers,
communities, or environment — including through financial
decisions that directly affect them (e.g. wage gaps,
profit-during-layoffs, executive pay vs worker pay)?

Reply with JSON:
{
  "relevant": true/false,
  "dimension": "labor|environment|social|politics|none",
  "impact_score": -10 to +10,
  "reasoning": "one sentence"
}`}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              This is the actual system prompt. No hidden criteria.
            </p>
          </CardContent>
        </Card>

        <p className="text-xs text-center text-muted-foreground pb-8">
          © 2026 Barcode Truth — Built on verified evidence, not opinion.
        </p>
      </main>
    </div>
  );
}
