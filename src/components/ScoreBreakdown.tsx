import { Link } from "react-router-dom";

type Cat = 'labor' | 'environment' | 'politics' | 'social';
type Breakdown = {
  component: Cat;
  base: number;
  base_reason: string;
  window_delta: number;
  value: number;
  confidence: number;
  verified_count: number;
  independent_owners: number;
  proof_required: boolean;
};

export default function ScoreBreakdown({
  brandId,
  blocks,
}: { brandId: string; blocks: Breakdown[] }) {
  return (
    <section className="rounded-2xl border p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Score transparency</h3>
        <Link
          to={`/brands/${brandId}/proof`}
          className="text-sm underline underline-offset-2"
        >
          View all evidence →
        </Link>
      </header>

      {blocks.map((b) => {
        const now = b.value;
        const delta = Math.round(b.window_delta);
        const sign = delta >= 0 ? '+' : '';
        const why = buildWhyLine(b);
        return (
          <div key={b.component} className="rounded-xl border p-3">
            <div className="flex items-center justify-between">
              <div className="font-medium capitalize">{b.component}</div>
              <div className="text-sm text-muted-foreground">
                Confidence <span className="font-medium">{b.confidence}</span>/100
              </div>
            </div>

            {/* base → delta → now */}
            <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">Base</div>
                <div className="font-medium">{b.base}</div>
                <div className="text-xs text-muted-foreground line-clamp-1" title={b.base_reason}>
                  {b.base_reason}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Δ window</div>
                <div className={`font-medium ${delta < 0 ? 'text-destructive' : 'text-foreground'}`}>
                  {sign}{delta}
                </div>
                <div className="text-xs text-muted-foreground">
                  {b.verified_count}/{b.independent_owners ? '2+' : '2+'} verified · {b.independent_owners} owners
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Now</div>
                <div className="font-semibold">{now}</div>
                {b.proof_required && (
                  <div className="text-xs text-amber-700">Proof required (delta muted)</div>
                )}
              </div>
            </div>

            {/* confidence bar */}
            <div className="mt-3 h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary transition-all"
                style={{ width: `${Math.max(4, Math.min(100, b.confidence))}%` }}
                aria-label={`Confidence ${b.confidence}/100`}
              />
            </div>

            {/* why line */}
            <p className="mt-3 text-sm text-muted-foreground">{why}</p>
          </div>
        );
      })}
    </section>
  );
}

function buildWhyLine(b: Breakdown) {
  const dir = b.window_delta === 0 ? 'unchanged' : (b.window_delta > 0 ? 'above' : 'below');
  const absΔ = Math.abs(Math.round(b.window_delta));
  const proof = b.proof_required ? ' Change detected but muted until independently verified.' : '';
  return `${capitalize(b.component)} ${b.value}: ${dir} baseline by ${absΔ}${
    absΔ ? ' pts' : ''
  } over the recent window, based on ${b.verified_count} verified source${
    b.verified_count === 1 ? '' : 's'
  } across ${b.independent_owners} independent owner${
    b.independent_owners === 1 ? '' : 's'
  }.${proof}`;
}

const capitalize = (s: string) => s.slice(0, 1).toUpperCase() + s.slice(1);
