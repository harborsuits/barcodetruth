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

      {blocks.map((b, idx) => {
        const now = b.value;
        const delta = Math.round(b.window_delta);
        const deltaStr = delta === 0 ? '—' : `${delta > 0 ? '+' : ''}${delta}`;
        const why = buildWhyLine(b, delta);
        return (
          <div key={b.component} className={`rounded-xl border p-3 space-y-3 ${idx > 0 ? 'border-t border-border/60' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="font-medium capitalize">{b.component}</div>
              <div className="text-sm text-muted-foreground" title={`Confidence ${b.confidence}/100`}>
                Confidence <span className="font-medium tabular-nums">{b.confidence}</span>/100
              </div>
            </div>

            {/* Methodology explanation */}
            <div className="text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg">
              <strong className="text-foreground">How we calculate this:</strong> Score = Baseline (from 24-month EPA/OSHA/FEC/news history) + Recent window changes (weighted by source verification & recency). All scores 0-100, higher = better labor/environmental/governance practices.
            </div>

            {/* base → delta → now */}
            <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground" title="24-month baseline (EPA/OSHA/FEC/news sentiment)">Base</div>
                <div className="font-medium tabular-nums">{b.base}</div>
                <div className="text-xs text-muted-foreground line-clamp-2 break-words" title={b.base_reason}>
                  {b.base_reason}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground" title="Net change in the current window">Δ window</div>
                <div className={`font-medium tabular-nums ${delta < 0 ? 'text-destructive' : delta === 0 ? 'text-muted-foreground' : 'text-foreground'}`}>
                  {deltaStr}
                </div>
                <div className="text-xs text-muted-foreground tabular-nums" title="Distinct ownership groups among verified sources">
                  {b.verified_count} verified · {b.independent_owners} owners
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Now</div>
                <div className="font-semibold tabular-nums">{now}</div>
                {b.proof_required && delta !== 0 && (
                  <div className="text-xs text-amber-700" title="Change detected, awaiting independent confirmation (≥2 owners or 1 official record). Delta is muted until verified.">
                    Proof required
                  </div>
                )}
              </div>
            </div>

            {/* confidence bar */}
            <div className="mt-3 h-1.5 rounded bg-muted">
              <div
                className={`h-1.5 rounded transition-[width] duration-300 ease-out ${b.confidence < 30 ? 'bg-amber-500' : 'bg-primary'}`}
                style={{ width: `${b.confidence}%` }}
                aria-label={`Confidence ${b.confidence}/100`}
              />
            </div>

            {/* why line */}
            <p className="mt-3 text-sm text-muted-foreground">{why}</p>

            {/* component anchor link */}
            <Link
              to={`/brands/${brandId}/proof#${b.component}`}
              className="mt-2 inline-block text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground"
            >
              View {b.component} evidence →
            </Link>
          </div>
        );
      })}
    </section>
  );
}

function buildWhyLine(b: Breakdown, delta: number) {
  if (delta === 0) {
    return 'No material change in the current window.';
  }
  const dir = delta > 0 ? 'above' : 'below';
  const pts = Math.abs(delta);
  const vc = Math.max(0, b.verified_count ?? 0);
  const io = Math.max(0, b.independent_owners ?? 0);
  const proof = b.proof_required ? ' Change muted until independently verified.' : '';
  return `${capitalize(b.component)} ${b.value}: ${dir} baseline by ${pts}${pts ? ' pts' : ''} in the recent window based on ${vc} verified source${
    vc === 1 ? '' : 's'
  } across ${io} independent owner${
    io === 1 ? '' : 's'
  }.${proof}`;
}

const capitalize = (s: string) => s.slice(0, 1).toUpperCase() + s.slice(1);
